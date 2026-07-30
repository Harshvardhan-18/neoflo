import { extractDomain } from '../utils/privacy';

const statusBadge = document.getElementById('status-badge');
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement | null;
const captureBtn = document.getElementById('capture-now-btn') as HTMLButtonElement | null;
const blockSiteBtn = document.getElementById('block-site-btn') as HTMLButtonElement | null;
const aiFeedContainer = document.getElementById('ai-feed');
const optionsLink = document.getElementById('open-options-link');
const consentLink = document.getElementById('open-consent-link');

const API_BASE_URL = 'http://localhost:8000/api/v1';

// 1. Initialize Status and Buttons
chrome.storage.local.get(['has_consented', 'is_paused', 'install_id'], async (storage) => {
  const hasConsented = storage.has_consented === true;
  const isPaused = storage.is_paused === true;

  updateStatusUI(hasConsented, isPaused);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const newPausedState = !isPaused;
      chrome.storage.local.set({ is_paused: newPausedState }, () => {
        window.location.reload();
      });
    });
  }

  // 2. Fetch AI Summaries Feed if consented & install_id exists
  if (hasConsented && storage.install_id) {
    fetchLatestAISummaries(storage.install_id);
  } else if (!hasConsented && aiFeedContainer) {
    aiFeedContainer.innerHTML = '<p style="font-size: 12px; color: var(--color-mocha);">Tracking disabled. Click "Consent Notice" below to enable.</p>';
  }
});

function updateStatusUI(hasConsented: boolean, isPaused: boolean): void {
  if (!statusBadge || !toggleBtn) return;

  if (!hasConsented) {
    statusBadge.innerHTML = '<span class="status-dot" style="background-color: var(--color-caramel);"></span> Consent Needed';
    toggleBtn.textContent = 'Enable Consent';
  } else if (isPaused) {
    statusBadge.innerHTML = '<span class="status-dot" style="background-color: var(--color-caramel);"></span> Paused';
    toggleBtn.textContent = 'Resume Tracking';
  } else {
    statusBadge.innerHTML = '<span class="status-dot"></span> Active';
    toggleBtn.textContent = 'Pause Tracking';
  }
}

// 3. Block Current Site Quick Action
if (blockSiteBtn) {
  blockSiteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const domain = extractDomain(tab.url);
    if (!domain) return;

    const storage = await chrome.storage.local.get(['blocklist_custom']);
    const customList: string[] = storage.blocklist_custom || [];

    if (!customList.includes(domain)) {
      customList.push(domain);
      await chrome.storage.local.set({ blocklist_custom: customList });
      blockSiteBtn.textContent = `Blocked (${domain})`;
      blockSiteBtn.style.backgroundColor = 'var(--color-latte)';
      setTimeout(() => window.location.reload(), 800);
    } else {
      blockSiteBtn.textContent = `Already Blocked`;
    }
  });
}

// 4. Capture Page Now Action
if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    captureBtn.textContent = 'Capturing...';
    captureBtn.disabled = true;

    chrome.runtime.sendMessage({ type: 'CAPTURE_NOW' }, () => {
      setTimeout(() => {
        captureBtn.textContent = 'Captured!';
        setTimeout(() => {
          captureBtn.textContent = 'Capture Page Now';
          captureBtn.disabled = false;
        }, 1000);
      }, 400);
    });
  });
}

// 5. Fetch recent AI summaries from backend
async function fetchLatestAISummaries(installId: string): Promise<void> {
  if (!aiFeedContainer) return;

  try {
    const response = await fetch(`${API_BASE_URL}/activity/timeline?page=1&limit=3`, {
      headers: { 'X-Install-Key': installId }
    });

    if (!response.ok) throw new Error('Failed loading timeline');

    const data = await response.json();
    const items = data.items || [];
    const summaries: Array<{ domain: string; text: string; time: string }> = [];

    for (const session of items) {
      for (const sc of session.screenshots || []) {
        for (const sumItem of sc.summaries || []) {
          summaries.push({
            domain: sc.domain,
            text: sumItem.summary_text,
            time: new Date(sumItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    }

    if (summaries.length === 0) {
      aiFeedContainer.innerHTML = '<p style="font-size: 12px; color: var(--color-mocha);">No AI summaries yet. Browse pages or click "Capture Page Now".</p>';
      return;
    }

    aiFeedContainer.innerHTML = summaries.slice(0, 3).map((item) => `
      <div class="feed-item">
        <div class="feed-item-header">
          <span>${item.domain}</span>
          <span>${item.time}</span>
        </div>
        <div class="feed-item-summary">${item.text}</div>
      </div>
    `).join('');
  } catch (err) {
    aiFeedContainer.innerHTML = '<p style="font-size: 12px; color: var(--color-mocha);">Backend offline or syncing...</p>';
  }
}

// Navigation links
if (optionsLink) {
  optionsLink.addEventListener('click', (evt) => {
    evt.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/options/index.html'));
    }
  });
}

if (consentLink) {
  consentLink.addEventListener('click', (evt) => {
    evt.preventDefault();
    window.open(chrome.runtime.getURL('src/consent/index.html'));
  });
}
