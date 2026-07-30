console.log('[Visual AI Agent] Popup UI script loaded.');

const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement | null;
if (toggleBtn) {
  let isPaused = false;
  toggleBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    toggleBtn.textContent = isPaused ? 'Resume Agent' : 'Pause Agent';
    toggleBtn.style.backgroundColor = isPaused ? 'var(--color-caramel)' : 'var(--color-mocha)';
  });
}
