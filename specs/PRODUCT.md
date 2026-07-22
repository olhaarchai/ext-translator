# Product

Store name: Kotiq Translate. Repository and package stay `ext-translator`; the IndexedDB
database name is also `ext-translator` and must never be renamed — it would orphan every
vocabulary already saved on a user's machine.

## Problem

Reading foreign-language pages means constantly switching to a translator tab, and the
words you look up are forgotten the moment the tab closes. Existing tools either send
text to a cloud service or stop at translation without helping you retain vocabulary.

## What the product does now

Translates text the user selects on a webpage — from an icon at the selection or from the
context menu — fully on-device via the browser's built-in translation model, or, in
browsers without one, via a bundled open-source engine whose models download once with
explicit consent and then work offline. Long passages
are translated in full and appear as they are produced. The extension reads either the
original or the translation aloud on request — so a reader learning the target language can
hear how it sounds — and lets the reader save any translation into a personal vocabulary
browsed from a side panel, opened from the toolbar icon or the right-click menu. Nothing
leaves the browser.

## Capabilities

| Capability                                   | Spec | Status   |
| -------------------------------------------- | ---- | -------- |
| Select-to-translate with on-device model     | 001  | implemented |
| Personal vocabulary (save translations)      | 002  | implemented |
| Pronunciation of the original (text-to-speech) | 003  | implemented |
| Selection icon trigger                       | 004  | implemented |
| Long text translation                        | 005  | implemented |
| Flashcard training (multiple-choice)         | 006  | implemented |
| Pronunciation of the translation             | 007  | implemented |
| Offline fallback engine (no built-in translator) | 008  | implemented |

## Release strategy

- Target: Chrome Web Store, public listing. Desktop Chromium 116+; on Chrome 138+ the
  built-in translation APIs are used, elsewhere the bundled offline engine (spec 008).
- Privacy stance is the product: all processing on-device, no accounts, no telemetry.
  The only network access is the one-time, explicitly consented download of translation
  model data from the pinned model host, in browsers without built-in translation
  (spec 008). Store listing and privacy disclosures must state exactly this.
- Spec 004 trades minimal permissions for one-click translation: the extension runs on all
  http(s) pages, so installation shows the "read your data on all websites" warning and
  store review is deeper. The permission justification must explain that page access
  exists only to read the user's own selection and render the bubble locally.
- Before first store submission: privacy policy URL, in-product first-run disclosure with
  explicit consent, per-permission justifications — including the model-host permission
  and the offline-engine download (spec 008), listing assets (icon 128×128,
  screenshots 1280×800, promo tile 440×280, one screenshot of the offline-engine offer),
  reviewer test instructions covering both the first-use language-pack download and the
  offline-engine consent-and-download flow.
