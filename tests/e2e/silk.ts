// Copied from math-tank tests/e2e/silk.ts (amendment 16 there; amendment 16 here as well, for the number pad).
/**
 * Amazon Fire tablets with the Silk browser, which is based on Chromium.
 * Silk's tablet user agent follows the template in the Amazon Silk Developer Guide
 * (https://docs.aws.amazon.com/silk/latest/developerguide/user-agent.html); the model codes come from Amazon's Fire
 * tablet specifications (KFQUWI Fire 7 2022, KFRASWI Fire HD 8 2024, KFTUWI Fire HD 10 2023). The Android, build and
 * Silk version numbers are examples (Fire OS 8 is based on Android 11); the game does not read the user agent.
 */
export const silkUserAgent = (model: string) =>
  `Mozilla/5.0 (Linux; Android 11; ${model} Build/RS8332.3115N) AppleWebKit/537.36 (KHTML, like Gecko) Silk/130.3.1 like Chrome/130.0.6723.102 Safari/537.36`;
/** Silk's desktop view sends a desktop Linux user agent (same guide). */
export const SILK_DESKTOP_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Silk/130.3.1 like Chrome/130.0.6723.102 Safari/537.36';

/**
 * Screen in CSS pixels = screen pixels / device pixel ratio, from Amazon's Fire tablet specifications (Fire 7: 1024 by
 * 600, mdpi = 1; Fire HD 8: 1280 by 800, tvdpi = 4/3; Fire HD 10: 1920 by 1200, hdpi = 1.5 for the 2019 and 2021
 * models; the 2023 model lists 224 ppi). The viewport subtracts an estimated 128 CSS pixels of height for the Fire OS
 * status bar (24), navigation bar (48) and Silk's address bar (56): Amazon publishes no viewport size for Silk.
 */
export const FIRE_DEVICES = [
  { id: 'fire-7', model: 'KFQUWI', screen: { width: 1024, height: 600 }, scale: 1 },
  { id: 'fire-hd-8', model: 'KFRASWI', screen: { width: 960, height: 600 }, scale: 4 / 3 },
  { id: 'fire-hd-10', model: 'KFTUWI', screen: { width: 1280, height: 800 }, scale: 1.5 },
] as const;
export const FIRE_BARS_HEIGHT = 128;

