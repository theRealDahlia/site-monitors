// Records a goal with the analytics service, if one is set up and loaded (see components/Analytics.tsx). It does
// nothing otherwise, and never throws, so tracking can never get in the way of what the visitor is doing.
declare global {
  interface Window {
    umami?: { track: (event: string) => void };
    plausible?: (event: string) => void;
  }
}

/** Returns true if an analytics script was there to tell (so a caller about to leave the page can give it a moment to send). */
export function trackEvent(name: string): boolean {
  try {
    window.umami?.track(name);
    window.plausible?.(name);
    return !!(window.umami || window.plausible);
  } catch {
    return false;
  }
}
