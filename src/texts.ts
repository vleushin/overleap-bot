export const getLanguage = (ctx: any): 'en' | 'ru' => {
    return ctx.message.from.language_code === 'ru' ? 'ru' : 'en';
};

export const getLanguageInFrom = (ctx: any): 'en' | 'ru' => {
    return ctx.from?.language_code === "ru" ? "ru" : 'en';
};

export const texts = {
    'en': {
        'launch': '🤑 Launch',
        'checkoutNavigation': '👇 Checkout navigation',
        'joinCommunity': '👉 Join Community',
        'open': 'Open',
        'launchCommand': 'Launch',
        'joinCommunityCommand': 'Community',
        'userIsNotUsingOverleap': 'Sorry, this user is not using Overleap',
        'openAppToSendMessage': 'Open app to send the message',
        'sendMessage' : 'Send message',
        'sendYourOverleapLink' : 'Send your Overleap link',
        'linkMessage' : '👋 Hey\\!\n\nI answer messages from my contacts list exclusively\\.\nSo the only way to reach me is via Overleap\\!\n\n ✉️ Message price: ',
    },
    'ru': {
        'launch': '🤑 Запуск',
        'checkoutNavigation': '👇 Навигация',
        'joinCommunity': '👉 Наш Комьюнити',
        'open': 'Открыть',
        'launchCommand': 'Запуск',
        'joinCommunityCommand': 'Комьюнити',
        'userIsNotUsingOverleap': 'К сожалению, этот пользователь не пользуется Overleap',
        'openAppToSendMessage': 'Открой приложение что бы отправить сообщение',
        'sendMessage' : 'Отправить',
        'sendYourOverleapLink': 'Отправь свою Overleap ссылку',
        'linkMessage': '👋 Привет\\!\n\nЯ отвечаю только на сообщения отправленые моими контактами\\.\nТак что единственный способ связаться со мной – через Overleap\\!\n\n✉️ Цена сообщения: ',
    }
};
