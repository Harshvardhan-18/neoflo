import { isDomainBlocked, extractDomain } from '../utils/privacy';
import { saveEventToBuffer, EventRecord } from '../utils/db';
import { getActiveSessionId, touchSession } from './session';
import { setupFlushAlarm, flushBufferedEvents } from './flush';
import { captureManager } from './capture';

console.log('[Visual AI Agent] Service Worker initializing...');

// Setup alarms on install and startup
function initAlarms(): void {
  setupFlushAlarm();

  // Setup 30s heartbeat alarm for idle screenshot capture
  chrome.alarms.get('heartbeat_capture_alarm', (alarm) => {
    if (!alarm) {
      chrome.alarms.create('heartbeat_capture_alarm', { periodInMinutes: 0.5 });
    }
  });
}

chrome.runtime.onInstalled.addListener(initAlarms);
chrome.runtime.onStartup.addListener(initAlarms);

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flush_events_alarm') {
    flushBufferedEvents();
  } else if (alarm.name === 'heartbeat_capture_alarm') {
    captureManager.enqueueCapture('heartbeat');
  }
});

async function bufferBackgroundEvent(
  type: string,
  url: string,
  tabId: number | null,
  metadata: Record<string, any> = {}
): Promise<string> {
  const eventId = crypto.randomUUID();
  if (!url || await isDomainBlocked(url)) {
    return eventId; // Skip if blocked
  }

  const domain = extractDomain(url);
  const sessionId = await getActiveSessionId();
  await touchSession();

  const record: EventRecord = {
    id: eventId,
    session_id: sessionId,
    type,
    url,
    domain,
    tab_id: tabId,
    metadata,
    occurred_at: new Date().toISOString(),
    synced: 0
  };

  await saveEventToBuffer(record);
  return eventId;
}

// 1. Tab Activation (Tab Switch)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await bufferBackgroundEvent('tab_switch', tab.url, activeInfo.tabId, { title: tab.title });
    }
  } catch (err) {
    // Ignore error
  }
});

// 2. Tab Navigation Complete
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const eventId = await bufferBackgroundEvent('navigation', tab.url, tabId, { title: tab.title });
    // Trigger visual capture linked to navigation event
    captureManager.enqueueCapture('navigation', tabId, eventId);
  }
});

// 3. Tab Closure
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const sessionId = await getActiveSessionId();
    await saveEventToBuffer({
      id: crypto.randomUUID(),
      session_id: sessionId,
      type: 'tab_close',
      url: 'about:blank',
      domain: 'browser',
      tab_id: tabId,
      metadata: {},
      occurred_at: new Date().toISOString(),
      synced: 0
    });
  } catch (e) {
    // Ignore error
  }
});

// 4. Message bridge from Content Scripts & Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_DOMAIN_BLOCKED') {
    isDomainBlocked(message.url).then((blocked) => {
      sendResponse({ blocked });
    });
    return true;
  }

  if (message.type === 'EVENT_CAPTURED') {
    const { eventType, url, metadata, tabId } = message.payload;
    bufferBackgroundEvent(eventType, url, tabId || sender.tab?.id || null, metadata).then(() => {
      sendResponse({ status: 'buffered' });
    });
    return true;
  }

  if (message.type === 'DOM_MUTATION_BURST') {
    if (sender.tab?.id) {
      captureManager.enqueueCapture('dom_mutation', sender.tab.id);
    }
    sendResponse({ status: 'enqueued' });
    return true;
  }

  if (message.type === 'CAPTURE_NOW') {
    captureManager.enqueueCapture('manual_popup');
    sendResponse({ status: 'capturing' });
    return true;
  }

  if (message.type === 'FORCE_FLUSH') {
    flushBufferedEvents().then(() => {
      sendResponse({ status: 'flushed' });
    });
    return true;
  }
});
