const DB_NAME = "order-mgmt";
const DB_VERSION = 1;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(syncPendingOrders());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_NOW") {
    syncPendingOrders()
      .then(() => notifyClients({ type: "SYNC_COMPLETE" }))
      .catch(() => notifyClients({ type: "SYNC_COMPLETE" }));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Order Management", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

function notifyClients(msg) {
  self.clients
    .matchAll({ includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage(msg)));
}

// ── IndexedDB helpers (mirrored from src/lib/idb.ts) ─────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pending-orders")) {
        const store = db.createObjectStore("pending-orders", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getPendingOrders(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readonly");
    const req = tx.objectStore("pending-orders").index("createdAt").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function updatePendingOrder(db, order) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readwrite");
    tx.objectStore("pending-orders").put(order);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function removePendingOrder(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readwrite");
    tx.objectStore("pending-orders").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Sync logic ────────────────────────────────────────────────────────────────

async function syncPendingOrders() {
  const db = await openDB();
  const pending = await getPendingOrders(db);

  for (const po of pending) {
    try {
      let orderId = po.orderId;

      // Step 1: create DRAFT order (idempotent)
      if (!orderId) {
        const createRes = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": po.idemKey1,
          },
          body: JSON.stringify({
            customerId: po.customerId,
            items: po.items,
            notes: po.notes,
          }),
        });

        if (!createRes.ok) {
          // Server-side rejection (validation, stock, etc.) — drop from queue
          await removePendingOrder(db, po.id);
          notifyClients({ type: "SYNC_ORDER_FAILED", id: po.id });
          continue;
        }

        const { id } = await createRes.json();
        orderId = id;
        await updatePendingOrder(db, { ...po, orderId });
      }

      // Step 2: submit DRAFT → PENDING (idempotent)
      const submitRes = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": po.idemKey2,
        },
        body: JSON.stringify({ status: "PENDING" }),
      });

      if (submitRes.ok) {
        await removePendingOrder(db, po.id);
        notifyClients({ type: "SYNC_ORDER_SUCCESS", id: po.id });
      }
    } catch {
      // Network error — stop here, retry on next sync
      break;
    }
  }
}
