const KEY = 'voicePrefs'

let cache: Record<string, string> = {}

export function preferredVoiceURI(lang: string): string | undefined {
  return cache[lang]
}

export async function setPreferredVoice(lang: string, voiceURI: string): Promise<void> {
  cache = { ...cache, [lang]: voiceURI }
  await chrome.storage.local.set({ [KEY]: cache })
}

export async function loadVoicePrefs(): Promise<void> {
  const stored = await chrome.storage.local.get(KEY)
  const value = stored[KEY]
  if (value && typeof value === 'object') cache = value as Record<string, string>

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cache = (changes[KEY].newValue as Record<string, string> | undefined) ?? {}
    }
  })
}
