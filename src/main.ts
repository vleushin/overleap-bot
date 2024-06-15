import dotenv from 'dotenv'
dotenv.config();

import { Scenes, session, Telegraf } from 'telegraf';
import { overleapDeepLinkWizard, overleapWizard, setPriceWizard } from './wizards';
import {
    handleConnectCommand,
    handleDisconnectCommand, handleFAQCommand,
    handleShowMyLinkCommand,
    handleShowMyPriceCommand,
    handleShowMyWalletCommand,
    handleStart
} from './commands';
import { setupWalletMenu } from './wallet-menu';

const bot = new Telegraf<Scenes.SceneContext>(process.env.BOT_TOKEN as string);
const stage = new Scenes.Stage<Scenes.SceneContext>([setPriceWizard, overleapWizard, overleapDeepLinkWizard], { ttl: 300 });
bot.use(session());
bot.use(stage.middleware());

bot.start(handleStart);
bot.command('set_price', ctx => ctx.scene.enter('set_price_wizard'));
bot.command('overleap', ctx => ctx.scene.enter('overleap_wizard'));
bot.command('connect', handleConnectCommand);
bot.command('disconnect', handleDisconnectCommand);
bot.command('my_wallet', handleShowMyWalletCommand);
bot.command('my_price', handleShowMyPriceCommand);
bot.command('my_link', handleShowMyLinkCommand);
bot.command('faq', handleFAQCommand);

setupWalletMenu(bot);

bot.launch({
    allowedUpdates: ['message', 'callback_query']
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
