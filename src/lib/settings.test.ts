import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTargetLanguage, grantConsent, hasConsent, setTargetLanguage } from './settings'

function stubChrome(uiLanguage: string): Record<string, unknown> {
  const store: Record<string, unknown> = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items)
        }),
      },
    },
    i18n: { getUILanguage: () => uiLanguage },
  })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('consent', () => {
  it('is not given by default and persists once granted', async () => {
    stubChrome('en-US')
    expect(await hasConsent()).toBe(false)
    await grantConsent()
    expect(await hasConsent()).toBe(true)
  })
})

describe('target language', () => {
  it('defaults to the browser UI language when supported', async () => {
    stubChrome('uk-UA')
    expect(await getTargetLanguage()).toBe('uk')
  })

  it('defaults to English when the UI language is unsupported', async () => {
    stubChrome('tlh')
    expect(await getTargetLanguage()).toBe('en')
  })

  it('prefers the stored choice over the UI language', async () => {
    stubChrome('uk-UA')
    await setTargetLanguage('de')
    expect(await getTargetLanguage()).toBe('de')
  })
})
