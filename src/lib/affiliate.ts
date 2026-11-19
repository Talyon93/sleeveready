// Partner ids for shop links, from the build environment (VITE_ variables; see .env.example).
import { affiliateConfig, englishRegionOf } from '../../shared/affiliate';

// English shop links follow where the visitor is: the browser's languages and time zone, read once.
const region = typeof navigator === 'undefined'
  ? 'us'
  : englishRegionOf(
    navigator.languages ?? [navigator.language],
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  );
export const affiliate = affiliateConfig(
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {},
  region,
);
