import { isDomainBlocked, extractDomain } from '../utils/privacy';
import { compressImageDataUrl } from '../utils/image';
import { saveScreenshotToBuffer, ScreenshotRecord } from '../utils/db';
import { getActiveSessionId, touchSession } from './session';

interface CaptureTask {
  tabId?: number;
  eventId?: string | null;
  trigger: string;
}

class CaptureQueueManager {
  private queue: CaptureTask[] = [];
  private isProcessing = false;
  private lastCaptureTime = 0;
  private MIN_CAPTURE_INTERVAL_MS = 1500; // Enforce 1.5s rate limit between Chrome API calls

  /**
   * Schedules a tab capture request.
   */
  public enqueueCapture(trigger: string, tabId?: number, eventId: string | null = null): void {
    // Avoid accumulating duplicate trigger items for same tab in queue
    const isDuplicate = this.queue.some((task) => task.trigger === trigger && task.tabId === tabId);
    if (!isDuplicate) {
      this.queue.push({ trigger, tabId, eventId });
    }
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      const now = Date.now();
      const timeSinceLast = now - this.lastCaptureTime;
      if (timeSinceLast < this.MIN_CAPTURE_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, this.MIN_CAPTURE_INTERVAL_MS - timeSinceLast));
      }

      await this.executeCapture(task);
      this.lastCaptureTime = Date.now();
    }

    this.isProcessing = false;
  }

  private async executeCapture(task: CaptureTask): Promise<void> {
    try {
      // 1. Get target tab details
      let tab: chrome.tabs.Tab | null = null;
      if (task.tabId) {
        try {
          tab = await chrome.tabs.get(task.tabId);
        } catch (e) {
          // Tab might have closed
        }
      }

      if (!tab) {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        tab = activeTab || null;
      }

      if (!tab || !tab.url || !tab.windowId) {
        return;
      }

      // 2. PRIVACY GATE: Absolute check before calling captureVisibleTab
      if (await isDomainBlocked(tab.url)) {
        console.log('[Visual AI Agent Privacy] Screenshot capture skipped for blocked domain:', tab.url);
        return;
      }

      // 3. Call Chrome capture API safely
      const rawDataUrl = await new Promise<string | null>((resolve) => {
        chrome.tabs.captureVisibleTab(tab!.windowId, { format: 'jpeg', quality: 80 }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            console.warn('[Visual AI Agent Capture] captureVisibleTab error:', chrome.runtime.lastError?.message);
            resolve(null);
          } else {
            resolve(dataUrl);
          }
        });
      });

      if (!rawDataUrl) {
        return;
      }

      // 4. Compress image payload (Offscreen Canvas resize to max 1024px, 0.70 quality)
      const compressedDataUrl = await compressImageDataUrl(rawDataUrl, 1024, 0.70);

      const domain = extractDomain(tab.url);
      const sessionId = await getActiveSessionId();
      await touchSession();

      // 5. Store record in IndexedDB screenshots_buffer
      const record: ScreenshotRecord = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        event_id: task.eventId || null,
        data_url: compressedDataUrl,
        domain,
        url: tab.url,
        captured_at: new Date().toISOString(),
        synced: 0
      };

      await saveScreenshotToBuffer(record);
      console.log(`[Visual AI Agent Capture] Screenshot captured (${task.trigger}) for domain: ${domain}, size: ${Math.round(compressedDataUrl.length / 1024)} KB`);
    } catch (err) {
      console.error('[Visual AI Agent Capture] Unexpected error executing capture:', err);
    }
  }
}

export const captureManager = new CaptureQueueManager();
