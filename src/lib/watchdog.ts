/**
 * Chromium forks (Brave, Dia, …) expose the built-in translation classes but lack the
 * download backend behind them, so create() can hang forever with no error. A watchdog
 * turns that silence into a detectable outcome. Activity (download progress) resets the
 * timer, so a genuinely slow download in a healthy browser is never cut off.
 *
 * The timeout races the promise rather than only aborting it: a broken implementation
 * that also ignores its abort signal must still not hang the caller.
 */
export async function withWatchdog<T>(
  run: (signal: AbortSignal, alive: () => void) => Promise<T>,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<T | 'timed-out'> {
  const controller = new AbortController()
  const onOuterAbort = () => controller.abort()
  outerSignal?.addEventListener('abort', onOuterAbort)

  let timer: ReturnType<typeof setTimeout> | undefined
  let fired = false
  let resolveTimeout!: (value: 'timed-out') => void
  const timedOut = new Promise<'timed-out'>((resolve) => {
    resolveTimeout = resolve
  })
  const fire = () => {
    fired = true
    controller.abort()
    resolveTimeout('timed-out')
  }
  const alive = () => {
    clearTimeout(timer)
    timer = setTimeout(fire, timeoutMs)
  }
  alive()

  try {
    const guarded = run(controller.signal, alive).catch((error: unknown) => {
      // The rejection is just the abort we caused; report the timeout instead.
      if (fired && outerSignal?.aborted !== true) return 'timed-out' as const
      throw error
    })
    // A rejection landing after the race has settled must not surface as unhandled.
    guarded.catch(() => {})
    return await Promise.race([guarded, timedOut])
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}
