import { Markup, Scenes } from 'telegraf';
import { overleapStorage } from './storage';
import { trackEvent } from './analytics';
import { getLanguage, getLanguageInFrom, texts } from './texts';
import { fromHashedId, toHashedId } from './ids';

export let handleStart = async (ctx: any): Promise<void> => {
    const payload = ctx.text!.substring(6);
    const language = getLanguage(ctx);

    trackEvent('start', ctx.message.from);
    if (payload.length) {
        trackEvent('deeplink', ctx.message.from);
        const toUsername = payload.toString().trim().toLowerCase();
        const toUserId = await overleapStorage.findUserIdByUsername(toUsername);
        if (!toUserId) {
            await ctx.reply(texts[language]['userIsNotUsingOverleap']);
            return;
        }
        const toUserHashedId = toHashedId(Number(toUserId));
        await ctx.reply(
            texts[language]['openAppToSendMessage'],
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            Markup.button.url('' + texts[language]['open'], `${process.env.BOT_LINK}/app?startapp=${toUserHashedId}`)
                        ]
                    ]
                }
            }
        );
        return;
    } else {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.url('' + texts[language]['launch'], `${process.env.BOT_LINK}/app`)
            //[Markup.button.webApp('' + texts[language]['launch'], process.env.TMA_URL as string)]
        ]);
        const result = await ctx.replyWithPhoto({ source: `images/start_${language}.png` }, keyboard);
        await ctx.sendMessage(texts[language]['checkoutNavigation'], {
            'reply_markup': {
                'resize_keyboard': true,
                'keyboard': [
                    [
                        Markup.button.url('' + texts[language]['launchCommand'], `${process.env.BOT_LINK}/app`),
                        Markup.button.text('' + texts[language]['joinCommunityCommand'])
                    ]
                ]
            }
        });
        await ctx.telegram.pinChatMessage(result.chat.id, result.message_id, false);
    }
};

export const handleCommunityCommand = async (ctx: any): Promise<void> => {
    const language = getLanguage(ctx);
    await ctx.reply(
        texts[language]['joinCommunity'],
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: texts[language]['open'],
                            url: 'https://t.me/overleap_app'
                        }
                    ]
                ]
            }
        }
    );
};

export const handleLaunchCommand = async (ctx: any): Promise<void> => {
    const language = getLanguage(ctx);
    await ctx.reply(
        texts[language]['launch'],
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: texts[language]['open'],
                            url: `${process.env.BOT_LINK}/app`
                        }
                    ]
                ]
            }
        }
    );
};

export const handleInlineQuery = async (ctx: Scenes.SceneContext) => {
    const hashedUserId = ctx.inlineQuery!.query;
    const userIdNumber = fromHashedId(hashedUserId);
    const userId = String(userIdNumber);
    const userPrice = (await overleapStorage.getUserPrice(userId)) || '0.1';
    const userWallet = await overleapStorage.findWalletByUserId(userIdNumber);

    if (!userWallet) {
        await ctx.answerInlineQuery([]);
        return;
    }

    const language = getLanguageInFrom(ctx);
    const description = texts[language]['sendYourOverleapLink'];
    const linkMessage = texts[language]['linkMessage'] + `*${userPrice.replace('.', '\\.')} USD₮*`;
    const sendMessage = texts[language]['sendMessage'];

    const ogImageUrl = 'https://raw.githubusercontent.com/vleushin/overleap/master/assets/overleap180.png';
    const redirectUrl = `${process.env.BOT_LINK}/app?startapp=${hashedUserId}`;
    const result: any[] = [
        {
            type: 'article',
            id: hashedUserId,
            title: 'Overleap',
            description: description,
            thumbnail_url: ogImageUrl,
            input_message_content: {
                message_text: linkMessage,
                parse_mode: 'MarkdownV2'
            },
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.url(sendMessage, redirectUrl) // Markup Helper from telegraf.js
                    ]
                ]
            }
        }
    ];

    await ctx.answerInlineQuery(result);
};
