# 005 — Long text translation

Status: implemented (2026-07-16)

## Why

Spec 001 caps a translation at 4000 characters and tells the reader the rest was dropped.
That cap was a safety guess, not a limit of the underlying translator: the browser API
documents no maximum input length and offers a streaming call precisely for longer text.
A reader who selects several paragraphs of an article should get all of them.

Two facts shape this feature. Translations are processed sequentially, so one very large
request blocks every later translation until it finishes — a page-sized selection would
make the extension feel frozen. And a long translation takes noticeable time, so the
reader should see it appear rather than stare at a spinner.

## User-visible behavior

- The translation appears progressively, growing as the translator produces it, instead of
  only showing up once the whole text is done.
- Selections far longer than 4000 characters are translated in full. The old truncation
  notice does not appear for them.
- A selection above a large safety ceiling is still truncated, and the bubble says so,
  naming the ceiling. This protects the reader from a whole-page selection that would
  block later translations.
- While the translation is still arriving, the bubble makes clear it is not finished yet.
- The bubble grows as text arrives and stays fully within the viewport, scrolling its own
  content rather than the page.
- While a long translation is scrolled inside the bubble, its header stays pinned at the
  top and the translation scrolls underneath it rather than showing through it. This holds
  in both states: while the text is still arriving the pinned header carries the
  in-progress indication, and once finished it carries the language pair, the listen
  control and the voice selector — so the reader can replay the original or switch voice
  without scrolling back up.
- The "Save to vocabulary" control appears only once the translation is complete, so a
  half-finished translation can never be saved.
- Closing the bubble while a translation is still arriving stops it.

## Edge cases and failure behavior

- If the stream fails partway through, the bubble shows the translation-failed message
  rather than silently leaving a half-translation on screen.
- A short selection behaves exactly as before: it simply completes quickly.
- The language picker and pronunciation keep working; switching the target language
  restarts the translation from scratch and the previous stream stops.

## Contract

- Uses the browser's streaming translation call; no new permissions and no network request.
- The safety ceiling is 50 000 characters. Text above it is truncated to the ceiling.
- Supersedes spec 001's 4000-character limit and its truncation criterion.

## Acceptance criteria

1. A translation is rendered incrementally: partial text is visible before the translation
   has finished.
2. A selection of, say, 10 000 characters is translated in full, with no truncation notice.
3. A selection above 50 000 characters is translated up to the ceiling and the bubble shows
   a notice naming it.
4. While the translation is incomplete the bubble shows an in-progress indication, and the
   save control is absent; once complete, the indication is gone and the save control is
   present.
5. A stream that fails partway shows the translation-failed message.
6. Closing the bubble during streaming stops the translation, and no further text is
   rendered afterwards.
7. Changing the target language during streaming stops the old translation and starts a new
   one; text from the abandoned translation never appears in the result.
8. As the translation grows, the bubble remains fully inside the viewport.
9. When a translation is long enough to scroll inside the bubble, the header row stays
   visible at the top while the translation scrolls under it, and the translation is never
   visible through the header. This holds both while the text is still arriving and after
   it has finished.
