console.log('[Visual AI Agent Consent] Consent script loaded.');

const acceptBtn = document.getElementById('accept-btn') as HTMLButtonElement | null;
const declineBtn = document.getElementById('decline-btn') as HTMLButtonElement | null;
const settingsLink = document.getElementById('open-settings-link') as HTMLAnchorElement | null;

if (acceptBtn) {
  acceptBtn.addEventListener('click', () => {
    chrome.storage.local.set({ has_consented: true, is_paused: false }, () => {
      alert('Consent accepted. Visual AI Agent tracking is now active.');
      window.close();
    });
  });
}

if (declineBtn) {
  declineBtn.addEventListener('click', () => {
    chrome.storage.local.set({ has_consented: false, is_paused: true }, () => {
      alert('Consent declined. Tracking will remain disabled.');
      window.close();
    });
  });
}

if (settingsLink) {
  settingsLink.addEventListener('click', (evt) => {
    evt.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/options/index.html'));
    }
  });
}
