import Mixpanel from 'mixpanel';

export const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN as string, {
    debug: true,
    verbose: true
});

export const trackEvent = (event: string, ctx: any, extraProperties: any = {}) => {
    mixpanel.track(event, {
        distinct_id: ctx.message.from.id,
        language_code: ctx.message.from.language_code,
        is_premium: ctx.message.from.is_premium,
        ...extraProperties
    });
};
