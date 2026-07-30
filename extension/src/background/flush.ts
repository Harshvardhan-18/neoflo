import { getUnsyncedEvents, deleteEvents, getUnsyncedScreenshots, deleteScreenshots } from '../utils/db';
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

/**
 * Flushes buffered events and screenshots to FastAPI backend.
 */
export async function flushBufferedEvents(): Promise<void> {
  const installId = await getInstallId();

  // 1. Flush Events Batch
  try {
    const unsyncedEvents = await getUnsyncedEvents(50);
    if (unsyncedEvents.length > 0) {
      const payloadEvents = unsyncedEvents.map((evt) => ({
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
        const syncedIds = unsyncedEvents.map((e) => e.id);
        await deleteEvents(syncedIds);
        console.log(`[Visual AI Agent Flush] Successfully flushed ${syncedIds.length} events.`);
      }
    }
  } catch (error) {
    console.error('[Visual AI Agent Flush] Error flushing events to backend:', error);
  }

  // 2. Flush Queued Screenshots
  try {
    const unsyncedScreenshots = await getUnsyncedScreenshots(5);
    for (const sc of unsyncedScreenshots) {
      const payload = {
        id: sc.id,
        session_id: sc.session_id,
        event_id: sc.event_id,
        data_url: sc.data_url,
        domain: sc.domain,
        url: sc.url,
        captured_at: sc.captured_at
      };

      const response = await fetch(`${API_BASE_URL}/screenshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Install-Key': installId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await deleteScreenshots([sc.id]);
        console.log(`[Visual AI Agent Flush] Successfully uploaded screenshot ${sc.id} to backend.`);
      }
    }
  } catch (error) {
    console.error('[Visual AI Agent Flush] Error uploading screenshots to backend:', error);
  }
}
