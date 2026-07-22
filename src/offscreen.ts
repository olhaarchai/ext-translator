import { OfflineEngine } from './lib/engine/offline-engine'
import { OFFLINE_PORT, type OfflineRequest, type OfflineResponse } from './lib/engine/offline-messages'

const engine = new OfflineEngine()

// The engine holds WASM memory plus loaded models; once nothing has used it for a
// while, closing the document returns that memory. The background page re-creates the
// document on the next request.
const IDLE_CLOSE_MS = 5 * 60_000
let activeJobs = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

function jobStarted(): void {
  activeJobs++
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = null
}

function jobEnded(): void {
  activeJobs--
  if (activeJobs > 0) return
  idleTimer = setTimeout(() => {
    if (activeJobs === 0) window.close()
  }, IDLE_CLOSE_MS)
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== OFFLINE_PORT) return
  port.onMessage.addListener((message: OfflineRequest) => {
    void handle(message, port)
  })
})

async function handle(message: OfflineRequest, port: chrome.runtime.Port): Promise<void> {
  jobStarted()
  const controller = new AbortController()
  port.onDisconnect.addListener(() => controller.abort())
  const post = (response: OfflineResponse) => {
    try {
      port.postMessage(response)
    } catch {
      // The bubble is gone and the port with it; the abort above stops the job.
    }
  }

  try {
    if (message.type === 'quote') {
      post({ type: 'quote-result', quote: await engine.quote(message.text, message.targetLanguage) })
      return
    }
    const outcome = await engine.translate(
      message.text,
      message.targetLanguage,
      (progress) => post({ type: 'progress', progress }),
      (translation) => post({ type: 'partial', translation }),
      controller.signal,
    )
    post({ type: 'outcome', outcome })
  } catch {
    post({ type: 'outcome', outcome: { kind: 'error', error: 'translation-failed' } })
  } finally {
    jobEnded()
  }
}
