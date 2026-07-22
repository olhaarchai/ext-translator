/**
 * The tiny Marian models are trained on sentences; a bare lowercase word can degenerate
 * outright ('troubling' → ", , , , ,"), while the same word shaped like a sentence
 * translates fine ('Troubling.' → 'Беспокойно.'). So a single selected word is wrapped
 * into sentence form for the engine and unwrapped afterwards.
 */
export type SingleWordWrap = { wrapped: string; loweredFirst: boolean }

export function wrapSingleWord(text: string): SingleWordWrap | null {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  if (!/[\p{L}\p{N}]$/u.test(trimmed)) return null

  const first = trimmed[0] ?? ''
  const capitalized = first.toUpperCase()
  const loweredFirst = capitalized !== first
  return {
    wrapped: `${loweredFirst ? capitalized + trimmed.slice(1) : trimmed}.`,
    loweredFirst,
  }
}

export function unwrapSingleWord(translation: string, wrap: SingleWordWrap): string {
  let result = translation.trim()
  if (result.endsWith('.')) result = result.slice(0, -1)
  if (wrap.loweredFirst && result !== '') {
    const first = result[0] ?? ''
    const lowered = first.toLowerCase()
    if (lowered !== first) result = lowered + result.slice(1)
  }
  return result
}
