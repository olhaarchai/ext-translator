import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadVoicePrefs, preferredVoiceURI, setPreferredVoice } from './voice-prefs'

function stubChrome(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial }
  const listeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = []
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items)
          for (const [key, newValue] of Object.entries(items)) {
            for (const fn of listeners) fn({ [key]: { newValue } }, 'local')
          }
        }),
      },
      onChanged: {
        addListener: (fn: (typeof listeners)[number]) => listeners.push(fn),
      },
    },
  })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('voice preferences', () => {
  it('has no preference before anything is stored', async () => {
    stubChrome()
    await loadVoicePrefs()
    expect(preferredVoiceURI('en')).toBeUndefined()
  })

  it('persists and returns a per-language choice', async () => {
    stubChrome()
    await loadVoicePrefs()
    await setPreferredVoice('en', 'voice://samantha')
    expect(preferredVoiceURI('en')).toBe('voice://samantha')
    expect(preferredVoiceURI('de')).toBeUndefined()
  })

  it('loads an existing preference from storage', async () => {
    stubChrome({ voicePrefs: { en: 'voice://daniel' } })
    await loadVoicePrefs()
    expect(preferredVoiceURI('en')).toBe('voice://daniel')
  })
})
