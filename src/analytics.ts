import Mixpanel from 'mixpanel';

export const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN as string, {
});

export const trackEvent = (event: string, from: any, extraProperties: any = {}) => {
    console.log("trackEvent: " + event + " , username: " + from.username)
    mixpanel.track(event, {
        distinct_id: from.id,
        language_code: from.language_code,
        is_premium: from.is_premium,
        ...extraProperties
    });
};
