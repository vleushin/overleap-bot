import dotenv from 'dotenv';
dotenv.config();

import { Scenes, Telegraf } from 'telegraf';
import {
    handleStart,
    handleCommunityCommand,
    handleLaunchCommand,
    handleInlineQuery
} from './commands';
import { texts } from './texts';

const bot = new Telegraf<Scenes.SceneContext>(process.env.BOT_TOKEN as string);

bot.start(handleStart);
bot.hears(texts.en.joinCommunityCommand, handleCommunityCommand);
bot.hears(texts.ru.joinCommunityCommand, handleCommunityCommand);
bot.hears(texts.en.launchCommand, handleLaunchCommand);
bot.hears(texts.ru.launchCommand, handleLaunchCommand);
bot.on('inline_query', handleInlineQuery);

bot.catch((err) => {
    console.log('Caught error in Bot!');
    console.error(err);
});

bot.launch({
    allowedUpdates: ['message', 'inline_query', 'callback_query']
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
