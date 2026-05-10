/**
 * IndexedDB storage for Jolene memory blob (server-encrypted ciphertext only).
 */

const DB_NAME = "uwekezaji-jolene-memory"
const DB_VERSION = 1
const STORE = "kv"
const RECORD_KEY = "encrypted_payload"

export function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"))
  })
}

export async function idbGetJoleneBlob(): Promise<string | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const g = tx.objectStore(STORE).get(RECORD_KEY)
    g.onsuccess = () => {
      const v = g.result
      resolve(typeof v === "string" ? v : null)
    }
    g.onerror = () => reject(g.error ?? new Error("idb get"))
    tx.oncomplete = () => db.close()
  })
}

export async function idbSetJoleneBlob(blob: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(blob, RECORD_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error("idb put"))
    tx.onabort = () => reject(tx.error ?? new Error("idb abort"))
  })
}

export async function idbClearJoleneBlob(): Promise<void> {
  if (!isIndexedDbSupported()) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).delete(RECORD_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error ?? new Error("idb delete"))
    })
  } catch {
    /* ignore */
  }
}
