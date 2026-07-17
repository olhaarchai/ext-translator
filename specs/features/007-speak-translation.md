# 007 — Pronunciation of the translation

Status: implemented (2026-07-17)

Supersedes the scope limit of [003](003-pronunciation.md): its contract line "Scope is the
original source-language text only" and its acceptance criterion 7 no longer hold. Every
other part of 003 — on-device voices only, toggle-to-stop, per-language voice choice —
carries over unchanged and governs this feature too.

## Why

Knowing what a phrase means is half of it; the reader also wants to know how it sounds in
the language they are translating into. Someone translating into Turkish to learn Turkish
has no way to hear the Turkish. Today the extension speaks only the text the reader already
knew how to say, and stays silent on the one they did not.

## User-visible behavior

- Wherever the original can be listened to, the translation can be listened to as well: in
  the translation bubble and on every saved vocabulary record.
- Each speaker control is attached to the language it speaks, so which one does what is
  visible without trying it: the control for the original sits with the source language,
  the control for the translation sits with the target language.
- The translation is spoken in the target language, using an on-device voice for that
  language, under exactly the rules 003 set: never a network-backed voice, and never the
  browser's own default.
- Starting playback of the translation stops playback of the original, and the other way
  round. Activating a control while it is speaking stops it.
- A voice selector is offered for each language that has more than one on-device voice.
  The choice is remembered per language, so a voice chosen for a language while it was the
  target is the same voice used later when that language is a source.

## The missing-voice case

Most systems ship voices for the interface language and little else, so for many target
languages there will be no on-device voice at all — the common case, not an edge case. 003
made such a control disabled with "No voice available for this language", which states a
fact the reader can do nothing with.

- When no on-device voice exists for a language, the disabled control explains that the
  operating system has no installed voice for it and that installing one in the system's
  speech settings enables it.
- The message names the language it is talking about, since two controls with different
  languages are now side by side.
- The extension does not link to, open, or detect system settings; it only says where to
  look. It cannot install a voice and does not pretend it can.

## Edge cases and failure behavior

- Nothing is spoken while a translation is still streaming; the control for the translation
  appears once the translation is complete, so playback never reads a half-finished text.
- A translation that failed, was aborted, or was skipped because the text was already in
  the target language offers no translation speaker.
- Closing the bubble stops playback started from it, whichever of the two controls started
  it.
- If voices load after the controls are drawn, a control disabled for a missing voice
  becomes usable without the reader reopening anything.
- Truncated long text speaks what is shown, never text the reader cannot see.

## Contract

- Uses the same Web Speech API path as 003. No new permission, no network request, and no
  new stored data beyond the per-language voice choice 003 already persists.
- The playback language for a translation is the target language it was translated into:
  the active target in the bubble, the stored target language for a saved record.

## Acceptance criteria

1. A completed translation in the bubble shows a speaker control for the translation
   alongside the one for the original; activating it speaks the translated text in the
   target language.
2. Each vocabulary record shows a speaker control for its translation; activating it speaks
   that record's translation in that record's target language.
3. Each of the two controls speaks its own text: the source control never speaks the
   translation and the target control never speaks the original.
4. Starting one control's playback while the other is speaking stops the other.
5. When no on-device voice exists for the target language, the translation's control is
   present but disabled, names that language, and says that installing a voice in the
   system's speech settings enables it. Activating it speaks nothing.
6. A network-backed voice is never used to speak a translation, even when it is the only
   voice the browser offers for that language.
7. No speaker control for the translation appears while the translation is still streaming,
   nor for a result that errored, aborted, or was skipped as same-language.
8. Choosing a voice for a language while it is the target language is honoured later when
   the same language appears as a source language, and the other way round.
9. The feature issues no network request and declares no additional permission.
