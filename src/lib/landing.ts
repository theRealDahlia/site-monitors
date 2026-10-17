// The "Run by site-monitors.net" credit in the app opens the landing page on purpose, even though
// logged-in people are normally kept off it. The link carries this marker, and the redirects (the
// proxy, and the client-side check that covers the Back button) let that one visit through. Typing
// the address, or coming back to it with Back, still goes to the dashboard.
export const LANDING_PARAM = "from";
export const LANDING_VALUE = "app";
export const LANDING_FROM_APP = `/?${LANDING_PARAM}=${LANDING_VALUE}`;
