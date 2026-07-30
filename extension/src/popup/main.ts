console.log('[Visual AI Agent] Popup UI script loaded.');

const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement | null;
const captureBtn = document.getElementById('capture-now-btn') as HTMLButtonElement | null;

if (toggleBtn) {
  // Read current pause status
  chrome.storage.local.get(['is_paused'], (storage) => {
    let isPaused = storage.is_paused === true;
    updatePauseUI(isPaused);

    toggleBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      chrome.storage.local.set({ is_paused: isPaused }, () => {
        updatePauseUI(isPaused);
      });
    });
  });
}

function updatePauseUI(isPaused: boolean): void {
  if (!toggleBtn) return;
  toggleBtn.textContent = isPaused ? 'Resume Tracking' : 'Pause Tracking';
  const statusBadge = document.getElementById('status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = isPaused
      ? '<span class="status-dot" style="background-color: var(--color-caramel);"></span> Paused'
      : '<span class="status-dot"></span> Active';
  }
}

if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    captureBtn.textContent = 'Capturing...';
    captureBtn.disabled = true;

    chrome.runtime.sendMessage({ type: 'CAPTURE_NOW' }, (response) => {
      setTimeout(() => {
        captureBtn.textContent = 'Captured!';
        setTimeout(() => {
          captureBtn.textContent = 'Capture Page Now';
          captureBtn.disabled = false;
        }, 1200);
      }, 500);
    });
  });
}
