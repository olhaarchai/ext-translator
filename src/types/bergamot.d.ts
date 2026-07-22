// Hand-written declarations for the untyped @browsermt/bergamot-translator package;
// only the surface this extension uses.
declare module '@browsermt/bergamot-translator/translator.js' {
  export interface BergamotOptions {
    registryUrl?: string
    workerUrl?: string
    pivotLanguage?: string | null
    cacheSize?: number
    useNativeIntGemm?: boolean
    downloadTimeout?: number
    onerror?: (error: Error) => void
  }

  export interface RegistryEntry {
    from: string
    to: string
    files: Record<string, { name: string; size: number; expectedSha256Hash: string } | undefined>
  }

  export interface TranslationRequest {
    from: string
    to: string
    text: string
    html?: boolean
    qualityScores?: boolean
  }

  export interface TranslationResponse {
    request: TranslationRequest
    target: { text: string }
  }

  export class CancelledError extends Error {}
  export class SupersededError extends Error {}

  export class TranslatorBacking {
    constructor(options?: BergamotOptions)
    options: BergamotOptions
    registry: Promise<RegistryEntry[]>
    loadModelRegistery(): Promise<RegistryEntry[]>
    loadWorker(): Promise<{ worker: Worker; exports: Record<string, (...args: unknown[]) => Promise<unknown>> }>
    getModels(pair: { from: string; to: string }): Promise<Array<{ from: string; to: string }>>
    fetch(url: string, checksum?: string, extra?: { signal?: AbortSignal }): Promise<ArrayBuffer>
  }

  export class LatencyOptimisedTranslator {
    constructor(options?: BergamotOptions, backing?: TranslatorBacking)
    translate(request: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResponse>
    delete(): Promise<void>
  }
}
