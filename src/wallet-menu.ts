import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { Markup, Scenes, Telegraf } from 'telegraf';
import { getConnector } from './ton-connect/connector';
import { addTGReturnStrategy, buildUniversalKeyboard } from './utils';
import { isTelegramUrl } from '@tonconnect/sdk';
import QRCode from 'qrcode';

export const setupWalletMenu = (bot: Telegraf<Scenes.SceneContext>) => {
    const onChooseWalletClick = async (ctx: any): Promise<void> => {
        const wallets = await getWallets();

        const walletButtons = wallets.map(wallet => (
            Markup.button.callback(wallet.name, JSON.stringify({ method: 'select_wallet', data: wallet.appName }))));
        const item = Markup.button.callback('« Back', JSON.stringify({
            method: 'universal_qr'
        }));
        await bot.telegram.editMessageReplyMarkup(
            ctx.update.callback_query.message.chat.id,
            ctx.update.callback_query.message.message_id,
            undefined,
            Markup.inlineKeyboard([walletButtons, [item]]).reply_markup
        );
    };

    bot.action(JSON.stringify({ method: 'universal_qr' }), (ctx) => {
        return onOpenUniversalQRClick(ctx);
    });

    bot.action(JSON.stringify({ method: 'chose_wallet' }), (ctx) => {
        return onChooseWalletClick(ctx);
    });

    const addWalletActions = async () => {
        const wallets = await getWallets();
        wallets.forEach((wallet) => {
            bot.action(JSON.stringify({ method: 'select_wallet', data: wallet.appName }), async (ctx) => {
                // @ts-ignore
                await onWalletClick(ctx, JSON.parse(ctx.update.callback_query.data).data);
                //return ctx.reply(wallet.appName).then(() => next());
            });
        });
    };
    addWalletActions();

    const onOpenUniversalQRClick = async (ctx: any): Promise<void> => {
        const chatId = ctx.update.callback_query.message.chat.id;
        const wallets = await getWallets();

        const connector = getConnector(chatId);

        const link = connector.connect(wallets);

        await editQR(ctx.update.callback_query.message, link);

        const keyboard = await buildUniversalKeyboard(link, wallets);

        await bot.telegram.editMessageReplyMarkup(
            chatId,
            ctx.update.callback_query.message.message_id,
            undefined,
            {
                inline_keyboard: [keyboard]
            }
        );
    };

    async function onWalletClick(ctx: any, data: string): Promise<void> {
        const chatId = ctx.update.callback_query.message.chat.id;
        const connector = getConnector(chatId);

        const selectedWallet = await getWalletInfo(data);
        if (!selectedWallet) {
            return;
        }

        let buttonLink = connector.connect({
            bridgeUrl: selectedWallet.bridgeUrl,
            universalLink: selectedWallet.universalLink
        });

        let qrLink = buttonLink;

        if (isTelegramUrl(selectedWallet.universalLink)) {
            buttonLink = addTGReturnStrategy(buttonLink, process.env.BOT_LINK as string);
            qrLink = addTGReturnStrategy(qrLink, 'none');
        }

        await editQR(ctx.update.callback_query.message, qrLink);

        await bot.telegram.editMessageReplyMarkup(
            chatId,
            ctx.update.callback_query.message.message_id,
            undefined,
            {
                inline_keyboard: [
                    [
                        {
                            text: '« Back',
                            callback_data: JSON.stringify({ method: 'chose_wallet' })
                        },
                        {
                            text: `Open ${selectedWallet.name}`,
                            url: buttonLink
                        }
                    ]
                ]
            }
        );
    }

    const editQR = async (message: any, link: string): Promise<void> => {
        const image = await QRCode.toBuffer(link);
        await bot.telegram.editMessageMedia(
            message.chat.id,
            message.message_id,
            undefined,
            {
                type: 'photo',
                media: {
                    source: image
                }
            }
        );
    };
};
