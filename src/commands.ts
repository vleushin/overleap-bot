import { getConnector } from './ton-connect/connector';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { CHAIN, isTelegramUrl, toUserFriendlyAddress, UserRejectsError } from '@tonconnect/sdk';
import { Address, beginCell, fromNano, toNano } from '@ton/ton';
import { deserializeBoc } from '@ton/core/dist/boc/cell/serialization';
import { Markup } from 'telegraf';
import QRCode from 'qrcode';
import { addTGReturnStrategy, buildUniversalKeyboard, pTimeout, pTimeoutException } from './utils';
import { findWalletUsdtJettonAddress } from './usdt';
import { overleapStorage } from './storage';
import { trackEvent } from './analytics';

const newConnectRequestListenersMap = new Map<number, () => void>();

export let handleStart = async (ctx: any): Promise<void> => {
    const payload = ctx.text!.substring(6);
    trackEvent('start', ctx);

    if (payload.length) {
        const toUsername = payload.toString().trim().toLowerCase();
        return ctx.scene.enter('overleap_deeplink_wizard', { toUsername });
    } else {
        await ctx.replyWithPhoto({ source: 'images/starter.png' });
    }
};

export let handleConnectCommand = async (ctx: any): Promise<void> => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;
    const username = ctx.message.from.username;
    let messageWasDeleted = false;

    trackEvent('connect', ctx);

    newConnectRequestListenersMap.get(chatId)?.();

    const connector = getConnector(chatId, () => {
        unsubscribe();
        newConnectRequestListenersMap.delete(chatId);
        deleteMessage();
    });

    await connector.restoreConnection();
    if (connector.connected) {
        const connectedName =
            (await getWalletInfo(connector.wallet!.device.appName))?.name ||
            connector.wallet!.device.appName;
        const address = connector.wallet!.account.address;
        await ctx.telegram.sendMessage(
            chatId,
            `You have already connect ${connectedName} wallet\nYour address: ${toUserFriendlyAddress(
                address,
                connector.wallet!.account.chain === CHAIN.MAINNET
            )}\n\n Disconnect wallet firstly to connect a new one`
        );

        return;
    }

    const unsubscribe = connector.onStatusChange(async wallet => {
        if (wallet) {
            await deleteMessage();

            const walletName =
                (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
            const address = connector.wallet!.account.address;
            await overleapStorage.register(userId, username, address);
            await ctx.telegram.sendMessage(chatId, `${walletName} wallet connected successfully`);
            unsubscribe();
            newConnectRequestListenersMap.delete(chatId);

            if (ctx.scene) {
                ctx.scene.reenter();
            }
        }
    });

    const wallets = await getWallets();

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    const keyboard = await buildUniversalKeyboard(link, wallets);
    const botMessage = await ctx.telegram.sendPhoto(chatId, {
        source: image
    }, {
        reply_markup: {
            inline_keyboard: [keyboard]
        }
    });
    const deleteMessage = async (): Promise<void> => {
        if (!messageWasDeleted) {
            messageWasDeleted = true;
            await ctx.telegram.deleteMessage(chatId, botMessage.message_id);
        }
    };

    newConnectRequestListenersMap.set(chatId, async () => {
        unsubscribe();

        await deleteMessage();

        newConnectRequestListenersMap.delete(chatId);
    });
};

export let handleDisconnectCommand = async (ctx: any): Promise<void> => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;
    const username = ctx.message.from.username;

    trackEvent('disconnect', ctx);

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await ctx.telegram.sendMessage(chatId, 'You didn\'t connect a wallet');
        return;
    }

    await connector.disconnect();
    await ctx.telegram.sendMessage(chatId, 'Wallet has been disconnected');
};

export let handleShowMyWalletCommand = async (ctx: any): Promise<void> => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;

    trackEvent('my_wallet', ctx);

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await ctx.telegram.sendMessage(chatId, 'You didn\'t connect a wallet');
        return;
    }

    const walletName =
        (await getWalletInfo(connector.wallet!.device.appName))?.name ||
        connector.wallet!.device.appName;

    await ctx.telegram.sendMessage(
        chatId,
        `Connected wallet: ${walletName}\nYour address: ${toUserFriendlyAddress(
            connector.wallet!.account.address,
            connector.wallet!.account.chain === CHAIN.TESTNET
        )}`
    );
};

export let handleShowMyPriceCommand = async (ctx: any): Promise<void> => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;
    trackEvent('my_price', ctx);

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await ctx.telegram.sendMessage(chatId, 'You didn\'t connect a wallet');
        return;
    }

    const price = (await overleapStorage.getUserPrice(chatId)) || '0.1';
    await ctx.telegram.sendMessage(chatId, `Your price is ${price} USDT`);
};

export let handleShowMyLinkCommand = async (ctx: any): Promise<void> => {
    const chatId = ctx.message.chat.id;
    const userId = ctx.message.from.id;
    const username = ctx.message.from.username;
    trackEvent('my_link', ctx);

    const link = `${process.env.BOT_LINK}'}?start=${username}`;
    const image = await QRCode.toBuffer(link);

    await ctx.telegram.sendMessage(chatId, `Your link is: ${link}`);
    await ctx.telegram.sendPhoto(chatId, {
        source: image
    });
};

export let handleSendTxCommand = async (
    ctx: any,
    toAddress: string,
    toUsername: string,
    fromAddress: string,
    fromUsername: string,
    price: number,
    toUserId: number,
    message: string): Promise<void> => {
    const chatId = ctx.message.chat.id;

    const connector = getConnector(chatId);
    await connector.restoreConnection();
    if (!connector.connected) {
        await ctx.telegram.sendMessage(chatId, 'Connect wallet to send transaction');
        return;
    }

    const forwardPayload = beginCell()
        .storeAddress(Address.parse(toAddress))
        .storeUint(0, 1) // without referral
        .endCell();

    const body2 = beginCell()
        .storeUint(0xf8a7ea5, 32)      // jetton transfer op code
        .storeUint(0, 64)              // query_id:uint64
        .storeCoins(BigInt(Number(price) * 10 ** 6))                               // amount:(VarUInteger 16) -  Jetton amount for transfer (decimals = 6 - jUSDT, 9 - default)
        .storeAddress(Address.parse(process.env.OVERLEAP_ROUTER_ADDRESS as string))       // destination:MsgAddress
        .storeAddress(Address.parse(fromAddress))   // response_destination:MsgAddress
        .storeBit(0)                         // no custom payload
        .storeCoins(40000000)               // forward amount (if >0, will send notification message)
        .storeBit(1)                         // we store forwardPayload as a reference
        .storeRef(forwardPayload)
        .endCell();

    trackEvent('overleap_prepare_transaction', ctx, {
        price: Number(price),
    });

    const usdtWalletAddress = await findWalletUsdtJettonAddress(fromAddress).toString();
    pTimeout(
        connector.sendTransaction({
            validUntil: Math.round(
                (Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS || 600000)) / 1000
            ),
            messages: [
                {
                    amount: '60000000',
                    address: usdtWalletAddress,
                    payload: body2.toBoc().toString('base64')
                }
            ]

        }),
        Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS || 600000)
    )
        .then((result) => {
            trackEvent('overleap_transaction_sent', ctx, {
                price: Number(price),
            });

            const cells = deserializeBoc(Buffer.from(result.boc, 'base64'));
            const transactionHash = cells[0]!.hash().toString('base64');

            const keyboard = Markup.inlineKeyboard([
                Markup.button.url('Tonscan', `https://tonscan.org/tx/by-msg-hash/${transactionHash}`),
                Markup.button.url('Tonviewer', `https://tonviewer.com/transaction/${transactionHash}`)
            ]);

            ctx.telegram.sendMessage(chatId, `Transaction sent successfully! (Takes some time to appear in explorers) `, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                ...keyboard
            });

            ctx.telegram.sendMessage(toUserId, `You got message from @${ctx.message.from.username} (paid ${price} USDT)!\n\n` + message,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: `Answer`,
                                    url: `https://t.me/${fromUsername}`
                                }
                            ]
                        ]
                    }
                }
            );
        })
        .catch(e => {
            if (e === pTimeoutException) {
                trackEvent('overleap_transaction_not_confirmed', ctx, {
                    price: Number(price),
                });
                ctx.telegram.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                trackEvent('overleap_transaction_rejected', ctx, {
                    price: Number(price),
                });
                ctx.telegram.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            trackEvent('overleap_transaction_unknown_error', ctx, {
                price: Number(price),
            });
            ctx.telegram.sendMessage(chatId, `Unknown error happened`);
        })
        .finally(() => connector.pauseConnection());

    let deeplink = '';
    const walletInfo = await getWalletInfo(connector.wallet!.device.appName);
    if (walletInfo) {
        deeplink = walletInfo.universalLink;
    }

    if (isTelegramUrl(deeplink)) {
        const url = new URL(deeplink);
        url.searchParams.append('startattach', 'tonconnect');
        deeplink = addTGReturnStrategy(url.toString(), process.env.BOT_LINK as string);
    }

    ctx.telegram.sendMessage(
        chatId,
        `✉️ Message: ${message}\n\n➡️ To: ${toUsername}\n\nOpen ${walletInfo?.name || connector.wallet!.device.appName} and confirm transaction`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open ${walletInfo?.name || connector.wallet!.device.appName}`,
                            url: deeplink
                        }
                    ]
                ]
            }
        }
    );
};


export let handleFAQCommand = async (ctx: any): Promise<void> => {
    const userId = ctx.message.from.id;
    trackEvent('faq', ctx);

    await ctx.reply('➡️ *What is Overleap?*\n\n' +
        'Overleap is a Telegram bot that allows you to receive paid messages from people outside of your contact list.\n' +
        '\n' +
        'Think of it as a paywall that is set between you and people outside of your network. People that have a genuine interest to connect - pay for the time you spend reading and answering their messages.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *Why do I need Overleap?*\n\n' +
        'Overleap helps you to manage your inbound messages effectively - filtering out the low-intent connection requests (spam, non-personal messages) and accepting only high-intent connection requests from people that value your time.\n' +
        '\n' +
        'It\'s a win-win for both parties. You are compensated for your time, while the sender receives a response for the message they have sent.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *How does Overleap work?*\n\n' +
        'Overleap generates a unique link that can be shared on your socials - Linkedin, Email etc.\n' +
        '\n' +
        'People that go through this link can reach you exclusively through the bot by paying a commission.\n' +
        '\n' +
        'So when the person pays your attention price, you will receive a message through the bot.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *How can I set my Overleap?*\n\n' +
        'To start accepting paid messages, go through these simple steps:\n' +
        '\n' +
        '*1. Connect your TON wallet to receive payments.*\n' +
        'Run /connect command in the bot.\n' +
        '\n' +
        'If you don\'t have a wallet yet, you can create one using \@wallet in Telegram or downloading Tonkeeper wallet from Android or Apple App Store.\n' +
        '\n' +
        'Overleap uses the TON Space wallet in Telegram.\n' +
        '\n' +
        '*2. Set your attention price.*\n' +
        'Run /set\\_price command and type your desired price.\n' +
        '\n' +
        '*3. Generate your unique Overleap link.*\n' +
        'Run /my\\_link to show your Overleap link.\n' +
        '\n' +
        'Copy your link and share it to your socials.\n' +
        '\n' +
        'You are all set! Now you can receive paid messages on Telegram.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *Why do I need a wallet?*\n\n' +
        'Overleap runs on TON blockchain. This way we ensure that you will receive your commission as fast as receiving a message.\n' +
        '\n' +
        'Wallet is used to accept and store funds you have earned with Overleap, as well as paying for the message you send to other people, using Overleap.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *What price should I set for myself?*\n\n' +
        'Setting prices is individual for everybody. To ensure a fair market price, we recommend starting between $1 and $5.\n', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *How can I get the most out of my Overleap?*\n\n' +
        'Overleap is best with Telegram Premium.\n' +
        '\n' +
        'Telegram Premium allows you to create Greeting Messages that are automatically sent to people who reach you on Telegram through your phone or handle.\n' +
        '\n' +
        'Add your unique Overleap bot into the Greeting Messages and set to show to anyone except your contacts and existing chats.', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *How does Overleap earn money?*\n\n' +
        'Overleap charges a flat fee of $1 from the sender.\n' +
        '\n' +
        'That means that if you have set a price for $5, the sender will pay $5 + Overleap commission of $1 + payment transaction fee (approx $0.10)\n', {
        parse_mode: 'Markdown'
    });
    await ctx.reply('➡️ *How can I withdraw my money from the wallet?*\n\n' +
        'The easiest way to convert your funds into fiat is to use @wallet P2P payments that are accessible in the wallet itself.\n' +
        '\n' +
        'Another way is to withdraw your USDT or TON to a centralized exchange that supports TON Blockchain.\n' +
        '\n' +
        'At the moment of this writing the exchanges that support TON are:\n' +
        'OKX\n' +
        'Bybit\n' +
        'Kucoin\n', {
        parse_mode: 'Markdown'
    });
};
