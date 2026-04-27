const DB_NAME = "order-mgmt";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
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

// ── Cart persistence ──────────────────────────────────────────────────────────

export type SavedCart = {
  customerId: string;
  customer: { id: string; name: string; address: string; phone?: string };
  items: { product: { id: string; name: string; price: number; stock: number }; quantity: number }[];
  notes: string;
};

export async function saveCart(data: SavedCart): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").put({ id: "current", ...data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCart(): Promise<SavedCart | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cart", "readonly");
    const req = tx.objectStore("cart").get("current");
    req.onsuccess = () => {
      const result = req.result;
      if (!result) return resolve(null);
      const { id: _id, ...data } = result;
      resolve(data as SavedCart);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearCart(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cart", "readwrite");
    tx.objectStore("cart").delete("current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Pending order queue ───────────────────────────────────────────────────────

export type PendingOrder = {
  id: string;
  idemKey1: string;
  idemKey2: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
  notes?: string;
  orderId: string | null;
  createdAt: number;
};

export async function queuePendingOrder(order: PendingOrder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readwrite");
    tx.objectStore("pending-orders").put(order);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updatePendingOrder(order: PendingOrder): Promise<void> {
  return queuePendingOrder(order);
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readonly");
    const req = tx.objectStore("pending-orders").index("createdAt").getAll();
    req.onsuccess = () => resolve(req.result as PendingOrder[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingOrder(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readwrite");
    tx.objectStore("pending-orders").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasPendingOrders(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-orders", "readonly");
    const req = tx.objectStore("pending-orders").count();
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}
