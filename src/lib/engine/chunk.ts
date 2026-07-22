/**
 * The offline engine translates a request as one unit, so streaming is emulated by
 * splitting the text into chunks and translating them in order. Newline runs are
 * preserved verbatim between chunks; oversized paragraphs are further split at sentence
 * boundaries so a single chunk stays small enough to keep partial results flowing.
 */
const MAX_CHUNK = 1200

export function splitForStreaming(text: string): string[] {
  const parts: string[] = []
  for (const part of text.split(/(\n+)/)) {
    if (part === '') continue
    if (part.startsWith('\n') || part.length <= MAX_CHUNK) {
      parts.push(part)
      continue
    }
    parts.push(...splitSentences(part))
  }
  return parts
}

function splitSentences(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?…])\s+/u)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const candidate = current === '' ? sentence : `${current} ${sentence}`
    if (candidate.length > MAX_CHUNK && current !== '') {
      chunks.push(current)
      current = sentence
    } else {
      current = candidate
    }
  }
  if (current !== '') chunks.push(current)
  return chunks
}

/** A chunk of bare newlines passes through untranslated. */
export function isPassthrough(chunk: string): boolean {
  return chunk.startsWith('\n')
}
