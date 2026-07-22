import { sha256Hex } from './digest'

// Separate database from the vocabulary ('ext-translator'): model blobs are a re-downloadable
// cache with a different lifecycle, and the vocabulary schema is frozen.
const DB_NAME = 'ext-translator-models'
const STORE = 'files'
const VERSION = 1

type StoredFile = { url: string; bytes: ArrayBuffer }

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

/**
 * Returns the cached bytes only when they still match the pinned hash; a mismatching
 * entry is dropped so the caller falls back to a fresh, verified download. The registry
 * hash is the single source of truth — the cache itself is never trusted.
 */
export async function getVerified(url: string, sha256: string): Promise<ArrayBuffer | null> {
  const db = await open()
  const found = await new Promise<StoredFile | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(url)
    request.onsuccess = () => resolve(request.result as StoredFile | undefined)
    request.onerror = () => reject(request.error)
  })
  if (found === undefined) return null
  if ((await sha256Hex(found.bytes)) !== sha256) {
    await remove(url)
    return null
  }
  return found.bytes
}

export async function put(url: string, bytes: ArrayBuffer): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put({ url, bytes } satisfies StoredFile)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}

async function remove(url: string): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(url)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function hasVerified(url: string, sha256: string): Promise<boolean> {
  return (await getVerified(url, sha256)) !== null
}

export async function resetForTest(): Promise<void> {
  if (dbPromise) (await dbPromise).close()
  dbPromise = null
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
