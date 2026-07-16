import type { VocabEntry, VocabKey } from './vocab-types'

const DB_NAME = 'ext-translator'
const STORE = 'entries'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: ['sourceText', 'sourceLanguage', 'targetLanguage'],
        })
        store.createIndex('addedAt', 'addedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function primaryKey(key: VocabKey): [string, string, string] {
  return [key.sourceText, key.sourceLanguage, key.targetLanguage]
}

// Writes settle on transaction completion, not on request success: a request can succeed
// and the transaction still abort (quota, later error), which would otherwise be reported
// to the user as a save that never persisted.
export async function addEntry(entry: VocabEntry): Promise<'added' | 'exists'> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    let outcome: 'added' | 'exists' = 'added'

    const request = transaction.objectStore(STORE).add(entry)
    request.onsuccess = () => {
      outcome = 'added'
    }
    request.onerror = (event) => {
      if (request.error?.name === 'ConstraintError') {
        // Expected: the entry is already saved. Swallow it so the transaction still commits.
        event.preventDefault()
        outcome = 'exists'
      }
    }

    // No onerror handler: a prevented ConstraintError still bubbles here, and a real
    // failure aborts the transaction, which onabort already reports.
    transaction.oncomplete = () => resolve(outcome)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function removeEntry(key: VocabKey): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(primaryKey(key))
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function hasEntry(key: VocabKey): Promise<boolean> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const request = store(db, 'readonly').getKey(primaryKey(key))
    request.onsuccess = () => resolve(request.result !== undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function listEntries(): Promise<VocabEntry[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const entries: VocabEntry[] = []
    const request = store(db, 'readonly').index('addedAt').openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        entries.push(cursor.value as VocabEntry)
        cursor.continue()
      } else {
        resolve(entries)
      }
    }
    request.onerror = () => reject(request.error)
  })
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
