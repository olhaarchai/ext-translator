# 001 — Select-to-translate

Status: accepted (2026-07-15)

## Why

The core loop of the product starts with frictionless translation at the point of
reading: select text, get a translation right there, without leaving the page or sending
the text anywhere. Everything later (vocabulary, flashcards) builds on this interaction.

## User-visible behavior

- Selecting text on an http(s) page and opening the context menu shows a
  "Translate selection" item. The item appears only when text is selected.
- Choosing the item opens a translation bubble near the selection. The bubble is
  visually isolated from the page (page styles do not leak in, bubble styles do not leak
  out) and never modifies page content.
- The source language is detected automatically from the selected text. The translation
  target is the user's target language: by default the browser UI language, changeable
  from a language picker inside the bubble. A change persists across sessions and
  immediately re-translates the current text.
- First use: before any selected text is processed, the bubble shows a short disclosure
  that translation runs on-device via the browser's built-in model and that selected
  text never leaves the browser. Translation proceeds only after the user explicitly
  agrees, once; agreement persists across sessions and pages.
- When the browser needs to download a language pack for the requested pair, the bubble
  shows download progress, then the translation appears without further user action.
- The bubble closes on Escape or on a click outside of it.

## Edge cases and failure behavior

Every failure state shows a distinct, human-readable message — no silent failures:

- Built-in translation is unavailable (unsupported browser/device, or disabled by
  enterprise policy): the bubble explains the feature requires a desktop browser with
  built-in translation.
- The detected source → target pair is not supported: the message names both languages.
- Language-pack download fails (e.g. offline): the message says the download failed and
  suggests retrying online.
- Source-language detection yields no usable result: the bubble says the language could
  not be detected.
- The browser blocks model access pending a user gesture: the bubble shows a Translate
  button; clicking it starts the translation.
- Detected source equals the target language: the bubble states the text is already in
  the target language instead of translating.
- Selections longer than 4000 characters are translated truncated to the first 4000
  characters, with a visible notice that the text was truncated.

## Contract

- Runs as a Manifest V3 extension; requires Chrome 138 or newer (declared, so older
  browsers are never offered the extension).
- Uses only the web platform `Translator` and `LanguageDetector` APIs for language work.
- Requested permissions are exactly: `contextMenus`, `activeTab`, `scripting`,
  `storage`. No host permissions; page access happens only on explicit user invocation.
- Privacy invariant: the extension itself performs no network requests. Language-pack
  downloads are performed by the browser, not the extension.

## Acceptance criteria

1. The context-menu item is registered for the `selection` context on http/https pages
   only, so it cannot appear without selected text.
2. Invoking the item on a selection produces a bubble containing the translation of the
   selected text into the target language.
3. With no prior consent recorded, the bubble shows the disclosure and no translation
   happens; after the user agrees, translation proceeds and consent is persisted — the
   disclosure is not shown again in later sessions.
4. With no stored target language, the target defaults to the browser UI language when
   supported, otherwise to English. Picking a different target persists it and
   re-translates the currently shown text.
5. When the language pair reports a pending download, progress updates are surfaced
   while downloading and the translation is delivered on completion.
6. Each failure state listed above maps to its own distinct message; the
   gesture-blocked state renders an actionable Translate button that retries.
7. A selection over 4000 characters yields a translation of the first 4000 characters
   and a truncation notice alongside the result.
8. When the detected source language equals the target, no translation call is made and
   the already-in-target-language notice is shown.
9. Escape and outside-click both close the bubble; repeated invocations on the same page
   do not stack bubbles or duplicate listeners.
