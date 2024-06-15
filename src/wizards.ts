import { WizardScene } from 'telegraf/scenes';
import { getConnector } from './ton-connect/connector';
import { handleConnectCommand, handleSendTxCommand } from './commands';
import { overleapStorage } from './storage';
import { mixpanel, trackEvent } from './analytics';

export const setPriceWizard = new WizardScene<any>(
    'set_price_wizard',
    ctx => {
        console.log(ctx)
        trackEvent('set_price_wizard_step_1', ctx);

        ctx.reply('Enter your price (default 0.1 USDT) in USDT');
        ctx.wizard.state.data = {};
        return ctx.wizard.next();
    },
    async ctx => {
        const price = Number(ctx.message.text);
        trackEvent('set_price_wizard_step_2', ctx, {
            price: Number(price)
        });
        if (!price) {
            ctx.reply(`Please enter valid number (e.g _0.1_, _5_, _9.99_)`, {
                parse_mode: 'Markdown'
            });
            return;
        }
        const priceInDimes = price * 10 ** 6;
        const finalPrice = Number(priceInDimes.toString().substring(0, priceInDimes.toString().length - 4));
        const convertedPrice = String(finalPrice / 100);
        await overleapStorage.setUserPrice(ctx.message.from.id, convertedPrice);
        ctx.reply(`Your price is now ${convertedPrice} USDT`);
        return ctx.scene.leave();
    }
);

export const overleapWizard = new WizardScene<any>(
    'overleap_wizard',
    async ctx => {
        const chatId = ctx.message.chat.id;
        const userId = ctx.message.from.id;
        trackEvent('overleap_wizard_step_1', ctx);

        const connector = getConnector(chatId);

        await connector.restoreConnection();
        if (!connector.connected) {
            await ctx.telegram.sendMessage(chatId, 'Please connect wallet first');
            return ctx.scene.leave();
        }

        if (ctx.scene.state.toUsername) {
            return ctx.wizard.next();
        } else {
            ctx.reply('Enter username you want to contact');
            return ctx.wizard.next();
        }
    },
    async ctx => {
        trackEvent('overleap_wizard_step_2', ctx);

        const toUsername = ctx.scene.state.toUsername || ctx.message.text.replace('@', '').toLowerCase().trim();
        if (toUsername === 'back') {
            trackEvent('overleap_wizard_step_2_back', ctx);
            return ctx.scene.leave();
        }

        const toUserId = await overleapStorage.findUserIdByUsername(toUsername);
        if (!toUserId) {
            trackEvent('overleap_wizard_step_2_not_using_overleap', ctx);
            ctx.reply(`Sorry, this user is not using *Overleap*. Try one more time or *back* to exit.`, {
                parse_mode: 'Markdown'
            });
            return;
        }

        const toUserPrice = (await overleapStorage.getUserPrice(toUserId)) || '0.1';

        ctx.reply(`*${toUsername}* overleap price is set to *${toUserPrice} USDT*.\n\nEnter message you would like to send or *back* to exit.`, {
            parse_mode: 'Markdown'
        });

        ctx.scene.state.toUsername = toUsername;
        ctx.scene.state.toUserId = toUserId;
        ctx.scene.state.toUserPrice = toUserPrice;

        return ctx.wizard.next();
    },
    async ctx => {
        const message = ctx.message.text;
        trackEvent('overleap_wizard_step_3', ctx);

        const chatId = ctx.message.chat.id;
        const username = ctx.message.from.username;
        const connector = getConnector(chatId);
        await connector.restoreConnection();

        const toAddress = await overleapStorage.findWalletByUserId(ctx.scene.state.toUserId) as string;
        const toUsername = ctx.scene.state.toUsername;
        const fromAddress = connector.wallet!.account.address;

        console.log(`Initiating overleap from ${fromAddress} to ${toAddress} in chat ${chatId} for ${ctx.scene.state.toUserPrice} USDT`);
        await handleSendTxCommand(
            ctx,
            toAddress,
            toUsername,
            fromAddress,
            username,
            ctx.scene.state.toUserPrice,
            ctx.scene.state.toUserId,
            message);
        return ctx.scene.leave();
    }
);

export const overleapDeepLinkWizard = new WizardScene<any>(
    'overleap_deeplink_wizard',
    async ctx => {
        trackEvent('overleap_deeplink_wizard_step_1', ctx);
        const toUsername = ctx.scene.state.toUsername;
        const toUserId = await overleapStorage.findUserIdByUsername(toUsername);
        if (!toUserId) {
            trackEvent('overleap_deeplink_wizard_step_1_not_using_overleap', ctx);
            ctx.reply(`Sorry, this user is not using *Overleap*.`, {
                parse_mode: 'Markdown'
            });
            return ctx.scene.leave();
        }

        const toUserPrice = (await overleapStorage.getUserPrice(toUserId)) || '0.1';

        if (ctx.scene.state.message) {
            console.log("Message is set!")
            const chatId = ctx.message.chat.id;
            const username = ctx.message.from.username;
            const connector = getConnector(chatId);
            await connector.restoreConnection();
            const toAddress = await overleapStorage.findWalletByUserId(ctx.scene.state.toUserId) as string;
            const toUsername = ctx.scene.state.toUsername;
            const fromAddress = connector.wallet!.account.address;
            await handleSendTxCommand(
                ctx,
                toAddress,
                toUsername,
                fromAddress,
                username,
                ctx.scene.state.toUserPrice,
                ctx.scene.state.toUserId,
                ctx.scene.state.message);
            return ctx.scene.leave();
        }

        ctx.reply(`*${toUsername}* overleap price is set to *${toUserPrice} USDT*.\n\nEnter message you would like to send or *back* to exit.`, {
            parse_mode: 'Markdown'
        });

        ctx.scene.state.toUsername = toUsername;
        ctx.scene.state.toUserId = toUserId;
        ctx.scene.state.toUserPrice = toUserPrice;

        return ctx.wizard.next();
    },
    async ctx => {
        trackEvent('overleap_deeplink_wizard_step_2', ctx);
        const message = ctx.scene.state.message || ctx.message.text;
        if (message === 'back') {
            return ctx.scene.leave();
        }
        ctx.scene.state.message = message;

        const chatId = ctx.message.chat.id;
        const username = ctx.message.from.username;
        const connector = getConnector(chatId);
        await connector.restoreConnection();
        if (!connector.connected) {
            trackEvent('overleap_deeplink_wizard_step_2_wallet_not_connected', ctx);
            await ctx.telegram.sendMessage(chatId, 'Please connect wallet first');
            await handleConnectCommand(ctx);
            return;
        }

        const toAddress = await overleapStorage.findWalletByUserId(ctx.scene.state.toUserId) as string;
        const toUsername = ctx.scene.state.toUsername;
        const fromAddress = connector.wallet!.account.address;

        console.log(`Initiating overleap (deeplink) from ${fromAddress} to ${toAddress} in chat ${chatId} for ${ctx.scene.state.toUserPrice} USDT`);
        await handleSendTxCommand(
            ctx,
            toAddress,
            toUsername,
            fromAddress,
            username,
            ctx.scene.state.toUserPrice,
            ctx.scene.state.toUserId,
            message);
        return ctx.scene.leave();
    }
);
