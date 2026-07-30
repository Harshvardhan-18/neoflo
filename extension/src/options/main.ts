import { SEED_BLOCKED_DOMAINS, extractDomain } from '../utils/privacy';
import { deleteEvents, getUnsyncedEvents, getUnsyncedScreenshots, deleteScreenshots } from '../utils/db';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const customListEl = document.getElementById('custom-domain-list');
const seedTagsEl = document.getElementById('seed-domain-tags');
const domainInput = document.getElementById('new-domain-input') as HTMLInputElement | null;
const addDomainBtn = document.getElementById('add-domain-btn') as HTMLButtonElement | null;
const exportDataBtn = document.getElementById('export-data-btn') as HTMLButtonElement | null;
const deleteDataBtn = document.getElementById('delete-data-btn') as HTMLButtonElement | null;
const reopenConsentBtn = document.getElementById('reopen-consent-btn') as HTMLButtonElement | null;

// 1. Render Pre-Seeded Tags
if (seedTagsEl) {
  seedTagsEl.innerHTML = SEED_BLOCKED_DOMAINS.map(
    (d) => `<span style="font-size: 11px; background: var(--color-latte); border: 1px solid var(--color-border); padding: 4px 8px; border-radius: 6px;">${d}</span>`
  ).join('');
}

// 2. Render Custom Blocklist
async function renderCustomBlocklist(): Promise<void> {
  if (!customListEl) return;
  const storage = await chrome.storage.local.get(['blocklist_custom']);
  const customList: string[] = storage.blocklist_custom || [];

  if (customList.length === 0) {
    customListEl.innerHTML = '<li style="font-size: 13px; color: var(--color-mocha);">No custom domains added yet.</li>';
    return;
  }

  customListEl.innerHTML = customList
    .map(
      (domain) => `
      <li class="domain-item">
        <span><strong>${domain}</strong></span>
        <button class="btn-pill btn-secondary btn-sm remove-domain-btn" data-domain="${domain}">Remove</button>
      </li>
    `
    )
    .join('');

  // Attach remove event listeners
  document.querySelectorAll('.remove-domain-btn').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      const target = evt.currentTarget as HTMLButtonElement;
      const domainToRemove = target.getAttribute('data-domain');
      if (domainToRemove) {
        await removeCustomDomain(domainToRemove);
      }
    });
  });
}

async function addCustomDomain(domain: string): Promise<void> {
  const cleanDomain = extractDomain(domain);
  if (!cleanDomain) return;

  const storage = await chrome.storage.local.get(['blocklist_custom']);
  const customList: string[] = storage.blocklist_custom || [];

  if (!customList.includes(cleanDomain)) {
    customList.push(cleanDomain);
    await chrome.storage.local.set({ blocklist_custom: customList });
    if (domainInput) domainInput.value = '';
    renderCustomBlocklist();
  }
}

async function removeCustomDomain(domain: string): Promise<void> {
  const storage = await chrome.storage.local.get(['blocklist_custom']);
  const customList: string[] = storage.blocklist_custom || [];
  const updated = customList.filter((d) => d !== domain);
  await chrome.storage.local.set({ blocklist_custom: updated });
  renderCustomBlocklist();
}

if (addDomainBtn && domainInput) {
  addDomainBtn.addEventListener('click', () => {
    if (domainInput.value.trim()) {
      addCustomDomain(domainInput.value.trim());
    }
  });
}

// 3. User Data Export Action
if (exportDataBtn) {
  exportDataBtn.addEventListener('click', async () => {
    exportDataBtn.textContent = 'Preparing Export...';
    exportDataBtn.disabled = true;

    try {
      const storage = await chrome.storage.local.get(['install_id']);
      if (!storage.install_id) throw new Error('No install ID found');

      const response = await fetch(`${API_BASE_URL}/data/export`, {
        method: 'POST',
        headers: { 'X-Install-Key': storage.install_id }
      });

      if (!response.ok) throw new Error('Export request failed');

      const data = await response.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `visual_ai_agent_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      exportDataBtn.textContent = 'Export Downloaded!';
    } catch (err) {
      alert('Error exporting data. Please check backend connection.');
      exportDataBtn.textContent = 'Export My Data (JSON)';
    } finally {
      exportDataBtn.disabled = false;
      setTimeout(() => {
        if (exportDataBtn) exportDataBtn.textContent = 'Export My Data (JSON)';
      }, 2000);
    }
  });
}

// 4. User Data Delete Action
if (deleteDataBtn) {
  deleteDataBtn.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to permanently delete all your browsing activity and screenshots from the server and local storage?');
    if (!confirmed) return;

    deleteDataBtn.textContent = 'Deleting Data...';
    deleteDataBtn.disabled = true;

    try {
      const storage = await chrome.storage.local.get(['install_id']);
      if (storage.install_id) {
        await fetch(`${API_BASE_URL}/data/delete`, {
          method: 'POST',
          headers: { 'X-Install-Key': storage.install_id }
        });
      }

      // Clear local IndexedDB buffers
      const unsyncedEvts = await getUnsyncedEvents(500);
      await deleteEvents(unsyncedEvts.map((e) => e.id));

      const unsyncedScs = await getUnsyncedScreenshots(500);
      await deleteScreenshots(unsyncedScs.map((sc) => sc.id));

      alert('All your browsing activity and screenshot data has been permanently deleted.');
      deleteDataBtn.textContent = 'Data Deleted';
    } catch (err) {
      alert('Error deleting backend data. Local buffer cleared.');
    } finally {
      deleteDataBtn.disabled = false;
      setTimeout(() => {
        if (deleteDataBtn) deleteDataBtn.textContent = 'Delete My Data Permanently';
      }, 2000);
    }
  });
}

// 5. Re-open Consent Notice
if (reopenConsentBtn) {
  reopenConsentBtn.addEventListener('click', () => {
    window.open(chrome.runtime.getURL('src/consent/index.html'));
  });
}

// Initial render
renderCustomBlocklist();
