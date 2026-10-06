const IN_APP_PATTERN = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|LinkedInApp|WhatsApp|; wv\)/i;
/** True inside webviews (Instagram, Facebook, WhatsApp...) where Google popup sign-in is blocked. */
export function isInAppBrowser(ua = navigator.userAgent) {
    return IN_APP_PATTERN.test(ua);
}
