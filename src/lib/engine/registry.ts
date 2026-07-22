import registryJson from './model-registry.json'

/**
 * The model registry is vendored into the package (not fetched at run time) so that the
 * set of downloadable files and their SHA-256 hashes is fixed at release time. The
 * remote host can then only serve bytes we already promised to accept — a compromised
 * host cannot substitute different model data.
 *
 * Source: https://storage.googleapis.com/bergamot-models-sandbox/0.3.3/registry.json
 */
export const MODEL_BASE_URL = 'https://storage.googleapis.com/bergamot-models-sandbox/0.3.3'

const PIVOT = 'en'

export type LanguagePair = { from: string; to: string }

export type ModelFile = { url: string; size: number; sha256: string }

type RegistryFileJson = { name?: string; size?: number; expectedSha256Hash?: string }

const registry = registryJson as Record<string, Record<string, RegistryFileJson>>

function pairKey({ from, to }: LanguagePair): string {
  return `${from}${to}`
}

function hasPair(pair: LanguagePair): boolean {
  return pairKey(pair) in registry
}

/**
 * The models needed to translate the pair: the direct model when one exists, otherwise
 * the two legs of an English pivot. Null when the registry cannot serve the pair.
 */
export function modelsFor(from: string, to: string): LanguagePair[] | null {
  if (from === to) return null
  const direct = { from, to }
  if (hasPair(direct)) return [direct]
  const outbound = { from, to: PIVOT }
  const inbound = { from: PIVOT, to }
  if (hasPair(outbound) && hasPair(inbound)) return [outbound, inbound]
  return null
}

// qualityModel files are excluded: quality estimation is unused and skipping them keeps
// downloads (and the engine) faster.
export function filesFor(pair: LanguagePair): ModelFile[] {
  const entry = registry[pairKey(pair)]
  if (entry === undefined) return []
  const files: ModelFile[] = []
  for (const [part, file] of Object.entries(entry)) {
    if (part === 'qualityModel') continue
    if (typeof file?.name !== 'string' || typeof file.expectedSha256Hash !== 'string') continue
    files.push({
      url: `${MODEL_BASE_URL}/${pairKey(pair)}/${file.name}`,
      size: file.size ?? 0,
      sha256: file.expectedSha256Hash,
    })
  }
  return files
}

/**
 * The vendored registry in the shape bergamot-translator's TranslatorBacking expects:
 * one entry per pair, file names replaced with absolute pinned URLs so the library
 * fetches exactly the artifacts this release promised.
 */
export function bergamotRegistry(): Array<{
  from: string
  to: string
  files: Record<string, { name: string; size: number; expectedSha256Hash: string }>
}> {
  return Object.entries(registry).map(([key, entry]) => {
    const files: Record<string, { name: string; size: number; expectedSha256Hash: string }> = {}
    for (const [part, file] of Object.entries(entry)) {
      if (part === 'qualityModel') continue
      if (typeof file?.name !== 'string' || typeof file.expectedSha256Hash !== 'string') continue
      files[part] = {
        name: `${MODEL_BASE_URL}/${key}/${file.name}`,
        size: file.size ?? 0,
        expectedSha256Hash: file.expectedSha256Hash,
      }
    }
    return { from: key.slice(0, 2), to: key.slice(2, 4), files }
  })
}

export function downloadSize(pairs: LanguagePair[]): number {
  return pairs.flatMap(filesFor).reduce((sum, file) => sum + file.size, 0)
}

export function offlineSourceLanguages(): string[] {
  return unique(Object.keys(registry).map((key) => key.slice(0, 2)))
}

/** Languages the offline engine can translate into, directly or as a pivot target. */
export function offlineTargetLanguages(): string[] {
  return unique(Object.keys(registry).map((key) => key.slice(2, 4)))
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort()
}
