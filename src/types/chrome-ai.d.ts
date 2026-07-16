type AIAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface DownloadProgressEvent extends Event {
  readonly loaded: number
}

interface AICreateMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: DownloadProgressEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
}

interface TranslatorCreateOptions {
  sourceLanguage: string
  targetLanguage: string
  monitor?: (monitor: AICreateMonitor) => void
  signal?: AbortSignal
}

declare class Translator {
  static availability(options: {
    sourceLanguage: string
    targetLanguage: string
  }): Promise<AIAvailability>
  static create(options: TranslatorCreateOptions): Promise<Translator>
  translate(text: string): Promise<string>
  translateStreaming(text: string): AsyncIterable<string>
  destroy(): void
}

interface LanguageDetectionResult {
  detectedLanguage: string
  confidence: number
}

interface LanguageDetectorCreateOptions {
  monitor?: (monitor: AICreateMonitor) => void
  signal?: AbortSignal
}

declare class LanguageDetector {
  static availability(): Promise<AIAvailability>
  static create(options?: LanguageDetectorCreateOptions): Promise<LanguageDetector>
  detect(text: string): Promise<LanguageDetectionResult[]>
  destroy(): void
}
