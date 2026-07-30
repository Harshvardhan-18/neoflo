export const SEED_BLOCKED_DOMAINS = [
  'bankofamerica.com',
  'chase.com',
  'wellsfargo.com',
  'citi.com',
  'capitalone.com',
  'paypal.com',
  'stripe.com',
  'venmo.com',
  'mychart.org',
  'epic.com',
  'health.google',
  'login.gov',
  'accounts.google.com',
  'id.me',
  'authenticator.pingidentity.com',
  'okta.com'
];

/**
 * Extracts clean domain hostname from a full URL or hostname string.
 */
export function extractDomain(urlOrHostname: string): string {
  try {
    if (!urlOrHostname) return '';
    if (urlOrHostname.startsWith('chrome://') || urlOrHostname.startsWith('chrome-extension://') || urlOrHostname.startsWith('about:')) {
      return '';
    }
    const urlObj = urlOrHostname.includes('://') ? new URL(urlOrHostname) : new URL(`http://${urlOrHostname}`);
    return urlObj.hostname.toLowerCase();
  } catch (e) {
    return urlOrHostname.toLowerCase();
  }
}

/**
 * Checks if a hostname matches any blocked domain or sub-domain.
 * e.g. "sub.chase.com" matches "chase.com".
 */
export function matchesDomainList(hostname: string, domainList: string[]): boolean {
  if (!hostname) return true; // Internal or invalid URLs treated as blocked for safety
  const cleanHost = hostname.toLowerCase();

  return domainList.some((blocked) => {
    const cleanBlocked = blocked.trim().toLowerCase();
    if (!cleanBlocked) return false;
    return cleanHost === cleanBlocked || cleanHost.endsWith(`.${cleanBlocked}`);
  });
}

/**
 * Main privacy gate check. Must be evaluated BEFORE taking any action (events or screenshots).
 */
export async function isDomainBlocked(urlOrHostname: string): Promise<boolean> {
  const domain = extractDomain(urlOrHostname);

  // Chrome internal pages or blank domains are skipped
  if (!domain || domain === 'newtab' || domain === 'extensions') {
    return true;
  }

  // 1. Check seed blocklist
  if (matchesDomainList(domain, SEED_BLOCKED_DOMAINS)) {
    return true;
  }

  // 2. Check user custom blocklist from storage
  try {
    const storage = await chrome.storage.local.get(['blocklist_custom', 'is_paused']);
    
    // Global pause toggle check
    if (storage.is_paused === true) {
      return true;
    }

    const customList: string[] = storage.blocklist_custom || [];
    if (matchesDomainList(domain, customList)) {
      return true;
    }
  } catch (err) {
    console.warn('[Visual AI Agent Privacy] Failed reading chrome.storage.local:', err);
  }

  return false;
}
