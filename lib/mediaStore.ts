"use client";

/**
 * مخزن وسائط محلي على IndexedDB لملفات الحصص التي يرفعها المعلم
 * (صور/فيديو/مرفقات). localStorage لا يتسع لهذه الأحجام، بينما
 * IndexedDB يخزن Blobs بمئات الميغابايت. لا يوجد باكند بعد.
 */

const DB_NAME = "hissa-media";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveMedia(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(blob, id);
  await txDone(tx);
  db.close();
}

export async function getMedia(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).get(id);
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  for (const id of ids) tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${bytes} بايت`;
}
