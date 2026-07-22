import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withWatchdog } from './watchdog'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function hang(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

describe('withWatchdog', () => {
  it('passes a fast result through', async () => {
    await expect(withWatchdog(async () => 'ok', 1000)).resolves.toBe('ok')
  })

  it('reports a silent hang as timed-out', async () => {
    const pending = withWatchdog((signal) => hang(signal), 1000)
    await vi.advanceTimersByTimeAsync(1001)
    await expect(pending).resolves.toBe('timed-out')
  })

  it('times out even when the hanging call ignores its abort signal', async () => {
    const pending = withWatchdog(() => new Promise<never>(() => {}), 1000)
    await vi.advanceTimersByTimeAsync(1001)
    await expect(pending).resolves.toBe('timed-out')
  })

  it('keeps waiting while activity arrives', async () => {
    let alive!: () => void
    let finish!: (value: string) => void
    const pending = withWatchdog((signal, bump) => {
      alive = bump
      void hang(signal).catch(() => {})
      return new Promise<string>((resolve) => {
        finish = resolve
      })
    }, 1000)

    await vi.advanceTimersByTimeAsync(800)
    alive()
    await vi.advanceTimersByTimeAsync(800)
    alive()
    finish('done')
    await expect(pending).resolves.toBe('done')
  })

  it('propagates the failure when the outer signal aborted, not a timeout', async () => {
    const outer = new AbortController()
    const pending = withWatchdog((signal) => hang(signal), 1000, outer.signal)
    outer.abort()
    await expect(pending).rejects.toThrow('aborted')
  })

  it('propagates a real error from the factory', async () => {
    await expect(
      withWatchdog(async () => {
        throw new Error('boom')
      }, 1000),
    ).rejects.toThrow('boom')
  })
})
