# Product

Working name: ext-translator (final store name TBD; must not contain third-party trademarks).

## Problem

Reading foreign-language pages means constantly switching to a translator tab, and the
words you look up are forgotten the moment the tab closes. Existing tools either send
text to a cloud service or stop at translation without helping you retain vocabulary.

## What the product does now

Translates text the user selects on a webpage, fully on-device via the browser's
built-in translation model. Nothing leaves the browser.

## Capabilities

| Capability                                   | Spec | Status   |
| -------------------------------------------- | ---- | -------- |
| Select-to-translate with on-device model     | 001  | accepted |
| Personal vocabulary (save translations)      | —    | planned  |
| Flashcard training with audio and choices    | —    | planned  |

## Release strategy

- Target: Chrome Web Store, public listing. Desktop Chrome 138+ only (built-in
  translation APIs are desktop-only).
- Privacy stance is the product: all processing on-device, no network calls of our own,
  no accounts, no telemetry. Store listing and privacy disclosures must state exactly this.
- Before first store submission: privacy policy URL, in-product first-run disclosure with
  explicit consent, per-permission justifications, listing assets (icon 128×128,
  screenshots 1280×800, promo tile 440×280), reviewer test instructions describing the
  first-use language-pack download.
