# 008 — Offline fallback translation engine

Status: implemented (2026-07-22)

## Why

The product currently works only where the browser ships the built-in `Translator` and
`LanguageDetector` APIs (desktop Chrome 138+). Every other Chromium-based browser (Brave,
Dia, Opera, older Chrome) can install the extension but hits a dead-end error. An
on-device fallback engine keeps the core promise — translation that never sends the text
anywhere — working in those browsers.

## User-visible behavior

- In a browser without built-in translation, selecting text and invoking translation no
  longer ends at "unsupported browser". Instead the bubble offers to enable offline
  translation: a short disclosure stating that translation runs on-device via an
  open-source engine, that the first use of a language pair downloads model data from a
  fixed publicly documented location, showing the download size for the detected pair,
  and that the selected text itself never leaves the browser.
- After the user agrees (once; persisted across sessions), the model downloads with
  visible progress and the translation appears, streaming as it is produced — the same
  bubble experience as the built-in path: language picker, save-to-vocabulary,
  pronunciation.
- Language pairs not involving English are translated by pivoting through English; the
  disclosure size covers everything the pair needs.
- Later selections in already-downloaded languages translate without any network
  activity, including fully offline.
- Switching the target language mid-use may trigger a further model download, shown with
  the same progress treatment but without a new consent prompt.
- The offline path offers only the languages its engine actually supports; the language
  picker reflects that narrower list.
- In a browser with built-in translation, nothing changes — the built-in engine is
  always preferred and no network requests are made.

## Edge cases and failure behavior

- Detection cannot identify a supported source language: distinct message, as today.
- The detected pair is not available in the offline engine: the message names both
  languages.
- Model download fails or is corrupted in transit (hash mismatch): the message says the
  download failed and offers retry; a corrupted file is never stored or used.
- The user declines the offer: nothing is downloaded; the offer reappears on next use.
- Selections longer than 5000 characters are truncated with a visible notice (a lower
  ceiling than the built-in path: the fallback engine runs on the CPU).
- Closing the bubble aborts any in-flight download and translation.

## Contract

- Engine: bergamot-translator (WASM build of Marian NMT, MPL-2.0) with the Mozilla
  translation models. The WASM binary and all executable code ship inside the extension
  package; the extension never downloads or executes remote code.
- Model data files are fetched only from the fixed model host pinned in the packaged
  registry; the manifest grants host access to exactly that origin and nothing else.
- Integrity: the packaged registry pins a SHA-256 hash for every model file. Downloaded
  bytes are hashed and verified before being stored or handed to the engine; a mismatch
  is treated as a failed download.
- Downloaded models are cached locally (IndexedDB, separate database from the
  vocabulary) so repeat use is fully offline. Cached bytes are re-verified against the
  pinned hash when read.
- The engine and model data run in an extension-private context (offscreen document +
  worker); web pages cannot reach either. The selected text leaves the page only to
  that extension context.
- Engine selection is by feature detection of the built-in APIs, never by user-agent
  sniffing.
- Privacy invariant (amends 001): the extension performs no network requests, except
  fetching translation model data files from the pinned model host after explicit
  consent. Selected text, translations, and vocabulary never leave the browser.

## Acceptance criteria

1. With built-in APIs present, translation uses them exclusively; no fetch to the model
   host occurs.
2. With built-in APIs absent, invoking translation shows the offline offer with a
   download size derived from the pinned registry for the detected pair (including the
   pivot models when the pair needs them); no network request happens before consent.
3. After consent, the pair's model files are fetched from the pinned host, verified
   against their pinned SHA-256 hashes, stored, and the translation is rendered
   streaming; consent is not asked again in later sessions.
4. A downloaded file whose hash does not match is discarded, is absent from the cache,
   and surfaces the download-failed message with retry.
5. With the pair's models cached, translation succeeds with network access unavailable.
6. A pair without a direct model translates via English pivot when both legs exist;
   a pair the registry cannot serve (directly or via pivot) shows the
   pair-unavailable message naming both languages.
7. The offline path's language picker offers exactly the registry-supported targets.
8. Selections over 5000 characters translate truncated with the truncation notice.
9. Saving to vocabulary and pronunciation work on offline-path results identically to
   built-in-path results.
