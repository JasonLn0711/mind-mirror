const QUEUE_KEY = "mind_mirror_event_queue";
const MAX_QUEUE_SIZE = 100;

function readQueue() {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
    return [];
  }
}

function writeQueue(queue) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
}

export function createTelemetry({ service, sessionToken }) {
  let flushTimer = 0;

  async function flush() {
    const queue = readQueue();
    if (queue.length === 0) {
      return;
    }

    try {
      await service.trackEvents({
        sessionToken,
        events: queue,
      });
      writeQueue([]);
    } catch (_error) {
      // keep queue for later retry
    }
  }

  function flushSoon() {
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => {
      flush();
    }, 200);
  }

  function track(eventType, eventPayload = {}) {
    const queue = readQueue();
    queue.push({
      clientEventId: crypto.randomUUID(),
      eventType,
      eventPayload,
      occurredAt: new Date().toISOString(),
    });
    writeQueue(queue);
    flushSoon();
  }

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  window.addEventListener("pagehide", flush);

  return {
    track,
    flush,
    flushSoon,
  };
}
