import { TranslatorBacking, type RegistryEntry } from '@browsermt/bergamot-translator/translator.js'
import { sha256Hex } from './digest'
import { getVerified, put } from './model-store'
import { bergamotRegistry } from './registry'

/** Distinguishes a failed/corrupted model download from a failure of translation itself. */
export class DownloadError extends Error {}

/**
 * TranslatorBacking that never trusts the network: the model registry comes from the
 * extension package instead of a remote URL, and every file download is verified against
 * the registry's pinned SHA-256 before it is cached or used. Verified files are cached in
 * IndexedDB, so repeat use works fully offline.
 */
export class PinnedBacking extends TranslatorBacking {
  /** Reports downloaded byte deltas of the current job; set by the active caller. */
  onBytes: ((delta: number) => void) | null = null

  constructor() {
    super({
      // Never used — loadModelRegistery is overridden below — but left invalid so an
      // accidental fallback to the library's remote-registry path fails loudly.
      registryUrl: 'about:invalid',
    })
  }

  // Called by the base-class constructor, so it must not touch instance fields.
  override loadModelRegistery(): Promise<RegistryEntry[]> {
    return Promise.resolve(bergamotRegistry())
  }

  override async fetch(url: string, checksum?: string, extra?: { signal?: AbortSignal }): Promise<ArrayBuffer> {
    if (checksum === undefined) throw new DownloadError('refusing to download a file without a pinned hash')

    const cached = await getVerified(url, checksum)
    if (cached !== null) return cached

    let bytes: ArrayBuffer
    try {
      bytes = await this.download(url, extra?.signal)
    } catch (error) {
      if (extra?.signal?.aborted) throw error
      throw new DownloadError(`could not download ${url}`, { cause: error })
    }
    if ((await sha256Hex(bytes)) !== checksum) {
      throw new DownloadError('downloaded file failed hash verification')
    }
    await put(url, bytes)
    return bytes
  }

  private async download(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const response = await globalThis.fetch(url, { credentials: 'omit', signal })
    if (!response.ok || response.body === null) {
      throw new Error(`unexpected response ${response.status}`)
    }
    const reader = response.body.getReader()
    const parts: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      received += value.byteLength
      this.onBytes?.(value.byteLength)
    }
    const bytes = new Uint8Array(received)
    let offset = 0
    for (const part of parts) {
      bytes.set(part, offset)
      offset += part.byteLength
    }
    return bytes.buffer
  }

  /**
   * Reimplemented (not inherited) because the library resolves its worker script via
   * import.meta.url, which does not survive bundling into the extension. The worker
   * files ship inside the package and load from the extension's own origin — no code is
   * ever fetched from the network.
   */
  override async loadWorker(): Promise<{
    worker: Worker
    exports: Record<string, (...args: unknown[]) => Promise<unknown>>
  }> {
    const worker = new Worker(chrome.runtime.getURL('worker/translator-worker.js'))

    let serial = 0
    const pending = new Map<number, { accept: (value: unknown) => void; reject: (error: Error) => void }>()

    const call = (name: string, ...args: unknown[]): Promise<unknown> =>
      new Promise((accept, reject) => {
        const id = ++serial
        pending.set(id, { accept, reject })
        worker.postMessage({ id, name, args })
      })

    worker.addEventListener('message', (event: MessageEvent) => {
      const { id, result, error } = event.data as { id: number; result?: unknown; error?: { message?: string } }
      const entry = pending.get(id)
      if (entry === undefined) return
      pending.delete(id)
      if (error !== undefined) entry.reject(new Error(error.message ?? 'translation worker error'))
      else entry.accept(result)
    })

    await call('initialize', this.options)

    return {
      worker,
      exports: new Proxy({} as Record<string, (...args: unknown[]) => Promise<unknown>>, {
        get(_target, name) {
          if (typeof name !== 'string' || name === 'then') return undefined
          return (...args: unknown[]) => call(name, ...args)
        },
      }),
    }
  }
}
