const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout

export interface ActiveSessionData {
  session_id: string;
  install_id: string;
  started_at: string;
  last_active_at: number;
}

/**
 * Gets or creates persistent anonymous install_id.
 */
export async function getInstallId(): Promise<string> {
  const storage = await chrome.storage.local.get(['install_id']);
  if (storage.install_id) {
    return storage.install_id;
  }
  const newInstallId = crypto.randomUUID();
  await chrome.storage.local.set({ install_id: newInstallId });
  return newInstallId;
}

/**
 * Gets active session_id, automatically renewing session if idle timeout exceeded.
 * Safe for MV3 service worker lifecycle (stateless timestamp comparison).
 */
export async function getActiveSessionId(): Promise<string> {
  const installId = await getInstallId();
  const storage = await chrome.storage.local.get(['active_session']);
  const now = Date.now();

  let session: ActiveSessionData | null = storage.active_session || null;

  if (session && session.last_active_at && (now - session.last_active_at < IDLE_TIMEOUT_MS)) {
    // Session is active; update last active timestamp
    session.last_active_at = now;
    await chrome.storage.local.set({ active_session: session });
    return session.session_id;
  }

  // Create brand new browsing session
  const newSession: ActiveSessionData = {
    session_id: crypto.randomUUID(),
    install_id: installId,
    started_at: new Date().toISOString(),
    last_active_at: now
  };

  await chrome.storage.local.set({ active_session: newSession });
  console.log('[Visual AI Agent Session] Started new session:', newSession.session_id);
  return newSession.session_id;
}

/**
 * Updates last active timestamp for active session.
 */
export async function touchSession(): Promise<void> {
  const storage = await chrome.storage.local.get(['active_session']);
  if (storage.active_session) {
    storage.active_session.last_active_at = Date.now();
    await chrome.storage.local.set({ active_session: storage.active_session });
  }
}
