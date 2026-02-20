const DB_NAME = "adblock-rust";
const DB_VERSION = 1;
const ENGINE_STORE = "engine";
const LISTS_STORE = "filter-lists";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENGINE_STORE)) {
        db.createObjectStore(ENGINE_STORE);
      }
      if (!db.objectStoreNames.contains(LISTS_STORE)) {
        db.createObjectStore(LISTS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(storeName, key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut(storeName, key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDelete(storeName, key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

export async function saveEngine(serializedBytes) {
  await idbPut(ENGINE_STORE, "serialized", serializedBytes);
}

export async function loadEngine() {
  return idbGet(ENGINE_STORE, "serialized");
}

export async function saveFilterListData(listId, data) {
  await idbPut(LISTS_STORE, listId, data);
}

export async function loadFilterListData(listId) {
  return idbGet(LISTS_STORE, listId);
}

export async function deleteFilterListData(listId) {
  await idbDelete(LISTS_STORE, listId);
}
