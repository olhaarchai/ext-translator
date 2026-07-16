# 003 — Pronunciation (text-to-speech)

Status: implemented (2026-07-16)

## Why

Reading a translation tells you what a word means; it does not tell you how to say it.
Hearing the word spoken aloud is central to learning a language. This feature lets the
reader listen to the original text — the foreign word or phrase they are learning — both
at the moment of translation and later when reviewing their saved vocabulary, entirely
on-device.

## User-visible behavior

- In the translation bubble, a speaker control sits next to the language pair. Activating
  it reads the original selected text aloud in its detected source language.
- In the vocabulary side panel, every saved record has a speaker control that reads that
  record's original text aloud in its source language.
- Activating the control starts playback. Activating it again while it is still speaking
  stops playback. Starting playback of another text on the same surface stops whatever was
  playing there.
- Playback uses an on-device voice matching the text's language. By default the best
  available such voice is chosen automatically. Voices that synthesise over the network are
  never used, even when the browser offers them: speaking with one would send the text to
  the voice vendor and break the promise that nothing leaves the browser.
- When more than one voice exists for a language, a voice selector lets the reader pick
  which one to use. The choice is remembered per language and applies everywhere that
  language is spoken, in both the bubble and the side panel.
- Only the original (source-language) text can be listened to; the translation is not
  spoken in this feature.

## Edge cases and failure behavior

- If the browser has no speech synthesis at all, no speaker control is shown anywhere.
- If speech synthesis exists but has no on-device voice for the text's language, the
  control is shown but disabled, and explains on hover that no voice is available for that
  language. A language served only by network voices counts as having none.
- Voices can load asynchronously; a control that was disabled because voices were not yet
  known becomes usable once a matching voice appears, without the user reopening anything.
- Closing the translation bubble — by pressing Escape, clicking away, or opening a new
  bubble — stops any playback that was started from it.

## Contract

- Uses the Web Speech API (`speechSynthesis`); requires no new permissions and makes no
  network request. Only voices reported as on-device are used, and playback never falls
  back to the browser's own default voice, which may be network-backed.
- The playback language is the text's own language code (the detected source language in
  the bubble, the stored source language for a saved record).
- Scope is the original source-language text only; this feature adds no way to speak a
  translation.

## Acceptance criteria

1. A translated result in the bubble shows a speaker control; activating it speaks the
   original text in the detected source language.
2. Each vocabulary record in the side panel shows a speaker control; activating it speaks
   that record's original text in its source language.
3. Activating a control while it is speaking stops playback; starting playback of a
   different text on the same surface stops the previous playback.
4. When the browser has no speech synthesis, no speaker control appears in the bubble or
   the side panel.
5. When no on-device voice exists for the text's language — including when the browser
   offers only network-backed ones — the control is present but disabled and communicates
   why on hover, and activating it speaks nothing.
6. The feature issues no network request and declares no additional permission.
7. There is no control anywhere that speaks the translation rather than the original.
8. Closing the translation bubble stops any playback that was started from it.
9. When two or more voices exist for a language, a voice selector is offered; choosing a
   voice persists per language and is used for later playback of that language in both the
   bubble and the side panel. The default selection is the best-scoring available voice.
