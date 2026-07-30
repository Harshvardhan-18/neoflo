import { getUnsyncedEvents, deleteEvents } from '../utils/db';
import { getInstallId } from './session';

const FLUSH_ALARM_NAME = 'flush_events_alarm';
const API_BASE_URL = 'http://localhost:8000/api/v1';

export function setupFlushAlarm(): void {
  chrome.alarms.get(FLUSH_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(FLUSH_ALARM_NAME, {
        periodInMinutes: 0.5 // Flush every 30 seconds
      });
      console.log('[Visual AI Agent Flush] Registered flush alarm every 30s');
    }
  });
}

export async function flushBufferedEvents(): Promise<void> {
  try {
    const unsynced = await getUnsyncedEvents(50);
    if (unsynced.length === 0) {
      return;
    }

    const installId = await getInstallId();

    // Map EventRecord array to expected API contract schema
    const payloadEvents = unsynced.map((evt) => ({
      id: evt.id,
      session_id: evt.session_id,
      type: evt.type,
      url: evt.url,
      domain: evt.domain,
      tab_id: evt.tab_id,
      metadata: evt.metadata,
      occurred_at: evt.occurred_at
    }));

    const response = await fetch(`${API_BASE_URL}/events/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Install-Key': installId
      },
      body: JSON.stringify({ events: payloadEvents })
    });

    if (response.ok) {
      const syncedIds = unsynced.map((e) => e.id);
      await deleteEvents(syncedIds);
      console.log(`[Visual AI Agent Flush] Successfully flushed ${syncedIds.length} events to backend.`);
    } else {
      console.warn('[Visual AI Agent Flush] Backend ingestion returned non-200:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[Visual AI Agent Flush] Error flushing events to backend:', error);
  }
}
