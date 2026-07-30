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

export function matchesDomainList(hostname: string, domainList: string[]): boolean {
  if (!hostname) return true;
  const cleanHost = hostname.toLowerCase();

  return domainList.some((blocked) => {
    const cleanBlocked = blocked.trim().toLowerCase();
    if (!cleanBlocked) return false;
    return cleanHost === cleanBlocked || cleanHost.endsWith(`.${cleanBlocked}`);
  });
}

/**
 * Main privacy gate check.
 * Strictly checks consent status (`has_consented`), seed blocklist, custom storage rules, and pause status.
 */
export async function isDomainBlocked(urlOrHostname: string): Promise<boolean> {
  const domain = extractDomain(urlOrHostname);

  // Chrome internal pages or blank domains are skipped
  if (!domain || domain === 'newtab' || domain === 'extensions') {
    return true;
  }

  // Check consent, pause status, and custom blocklist from storage
  try {
    const storage = await chrome.storage.local.get(['has_consented', 'is_paused', 'blocklist_custom']);
    
    // 1. Consent Gate: Fail closed if user has not explicitly consented
    if (storage.has_consented !== true) {
      return true;
    }

    // 2. Global pause toggle check
    if (storage.is_paused === true) {
      return true;
    }

    // 3. Seed blocklist check
    if (matchesDomainList(domain, SEED_BLOCKED_DOMAINS)) {
      return true;
    }

    // 4. Custom blocklist check
    const customList: string[] = storage.blocklist_custom || [];
    if (matchesDomainList(domain, customList)) {
      return true;
    }
  } catch (err) {
    console.warn('[Visual AI Agent Privacy] Failed reading chrome.storage.local:', err);
    return true; // Fail closed on error
  }

  return false;
}
