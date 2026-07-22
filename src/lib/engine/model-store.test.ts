import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { sha256Hex } from './digest'
import { getVerified, hasVerified, put, resetForTest } from './model-store'

const URL = 'https://models.example/pair/model.bin'

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

afterEach(async () => {
  await resetForTest()
})

describe('model-store', () => {
  it('returns stored bytes when they match the pinned hash', async () => {
    const bytes = bytesOf('model-data')
    await put(URL, bytes)
    const found = await getVerified(URL, await sha256Hex(bytes))
    expect(found).not.toBeNull()
    expect(new TextDecoder().decode(found!)).toBe('model-data')
  })

  it('misses for a url that was never stored', async () => {
    expect(await getVerified(URL, await sha256Hex(bytesOf('x')))).toBeNull()
  })

  it('drops and misses an entry whose bytes do not match the pinned hash', async () => {
    await put(URL, bytesOf('tampered'))
    const pinned = await sha256Hex(bytesOf('original'))
    expect(await getVerified(URL, pinned)).toBeNull()
    // The corrupted entry must be gone even for a caller pinning the tampered hash:
    // getVerified evicted it rather than leaving it to be served later.
    expect(await hasVerified(URL, await sha256Hex(bytesOf('tampered')))).toBe(false)
  })
})

describe('sha256Hex', () => {
  it('matches the known SHA-256 test vector', async () => {
    expect(await sha256Hex(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
