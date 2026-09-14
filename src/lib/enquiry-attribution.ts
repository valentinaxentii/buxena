/** Campaign context for this tab only. No cookies, visitor ID or vendor requests. */
export interface EnquiryAttribution {
  landingPath?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

const KEY = 'buxena:inquiryAttribution';
const MAX_AGE = 30 * 60 * 1000;
const CAMPAIGN_KEYS = {
  utmSource: 'utm_source', utmMedium: 'utm_medium', utmCampaign: 'utm_campaign',
  utmContent: 'utm_content', utmTerm: 'utm_term',
} as const;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function cleanContext(value: unknown): EnquiryAttribution {
  if (!value || typeof value !== 'object') return {};
  const context: EnquiryAttribution = {};
  for (const key of ['landingPath', 'referrerHost', ...Object.keys(CAMPAIGN_KEYS)] as (keyof EnquiryAttribution)[]) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== 'string') continue;
    // Paths never include queries or fragments, which may contain contact details.
    const text = (key === 'landingPath' ? raw.split(/[?#]/)[0] : raw).replace(/[\r\n\t]/g, ' ').trim();
    if (text) context[key] = text.slice(0, key === 'landingPath' ? 300 : 160);
  }
  return context;
}

/** Retain the first landing context through catalogue → model → inquiry. */
export function sessionAttribution({ url, referrer = '', storage, now = Date.now(), optOut = false }: {
  url: string; referrer?: string; storage?: StorageAccess; now?: number; optOut?: boolean;
}): EnquiryAttribution {
  if (optOut) {
    try { storage?.removeItem(KEY); } catch { /* storage is optional */ }
    return {};
  }
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (typeof saved?.createdAt === 'number' && now >= saved.createdAt && now - saved.createdAt < MAX_AGE) {
      const context = cleanContext(saved.context);
      if (context.landingPath) return context;
    }
  } catch { /* corrupt or unavailable storage must never block a form */ }

  let page: URL;
  try { page = new URL(url); } catch { return {}; }
  const current: EnquiryAttribution = { landingPath: page.pathname };
  try {
    const host = new URL(referrer).hostname;
    if (host !== page.hostname) current.referrerHost = host;
  } catch { /* direct visit or no usable referrer */ }
  for (const [field, param] of Object.entries(CAMPAIGN_KEYS)) {
    current[field as keyof EnquiryAttribution] = page.searchParams.get(param) ?? '';
  }
  const context = cleanContext(current);
  try { storage?.setItem(KEY, JSON.stringify({ createdAt: now, context })); } catch { /* use this page's context */ }
  return context;
}

export function inquiryAttribution(): EnquiryAttribution {
  if (typeof window === 'undefined') return {};
  let storage: StorageAccess | undefined;
  try { storage = window.sessionStorage; } catch { /* browser restrictions */ }
  const preferences = navigator as Navigator & { globalPrivacyControl?: boolean };
  return sessionAttribution({
    url: window.location.href, referrer: document.referrer, storage,
    optOut: preferences.globalPrivacyControl === true || preferences.doNotTrack === '1',
  });
}
