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
  let changedWhileLoading = false

  // Subscribe before reading: a write from another context (the side panel) landing during
  // the read would otherwise go unnoticed...
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      changedWhileLoading = true
      cache = (changes[KEY].newValue as Record<string, string> | undefined) ?? {}
    }
  })

  const stored = await chrome.storage.local.get(KEY)

  // ...and the snapshot we are holding predates it, so applying it would clobber the newer
  // value and leave the cache stale until the next write.
  if (changedWhileLoading) return

  const value = stored[KEY]
  if (value && typeof value === 'object') cache = value as Record<string, string>
}
