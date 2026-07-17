# 006 — Flashcard training

Status: implemented (2026-07-16)

## Why

Saving a word (spec 002) records it; it does not teach it. Recognising a word again, under
mild pressure, and being told immediately whether you were right, is what moves it into
memory. This feature closes the product's loop: read → translate → save → learn.

The trainer draws only on what the reader collected themselves, so every question is a
word they actually met while reading.

## User-visible behavior

Starting:

- The side panel offers a way to start training from the saved vocabulary.
- Training needs at least four *distinct translations* sharing a target language, because
  the wrong answers are other saved translations and a card must show four options that
  all read differently. Two entries that share a translation therefore count once. Below
  that, the panel explains what is missing rather than offering a broken start.

A card:

- The card shows a saved entry's **original** text and a speaker control to hear it, as
  spec 003 defines. Under it are four answer options: the entry's own translation and
  three translations taken from other saved entries with the same target language.
- Options are shuffled, so the correct one is not in a fixed place.
- Long text is **shortened to fit**: an original or an option longer than what the card
  can show is cut with a visible indication that it continues. Activating a shortened
  text expands it in place to its full length; activating it again collapses it. Expanding
  is available before and after answering, and never counts as answering.
- Choosing an option immediately reveals the outcome: the chosen option is marked right or
  wrong, and when it is wrong the correct one is marked too. Nothing else is required to
  see the answer.
- After answering, the options stop responding — the answer cannot be changed — and the
  reader moves on to the next card.

A session:

- A session runs through a shuffled set of the eligible entries, one card at a time, and
  shows how far along it is.
- At the end, the session reports how many were answered correctly out of how many.
- The session can be left at any time, which returns to the vocabulary list.
- Deleting the entry a session is built from does not break the session in progress.

## Edge cases and failure behavior

- With exactly four distinct translations, every card still gets three distinct wrong
  options — they are simply the other three.
- Two saved entries can share a translation. Options are de-duplicated by their text, so a
  card never shows the same answer twice, and never shows a wrong option identical to the
  correct one. Such a pair counts once towards the four needed to start, so training is
  never offered when a card could not be filled.
- Entries whose target language differs are never mixed into one card: options would be in
  a different language and give the answer away.
- A card whose original has no on-device voice simply shows no speaker control, exactly as
  spec 003 states.
- Shortening never changes what is compared: the full text decides right and wrong, not
  the shortened form.

## Contract

- Reads the vocabulary through the same service-worker-owned store as spec 002; the
  trainer adds no new permission and makes no network request.
- Wrong options come only from the reader's own saved entries. Nothing is generated, so
  training works offline and on any device that can run the extension.
- A session is transient: leaving it or closing the panel discards it. No progress,
  scheduling or per-entry statistics are stored by this feature.
- Training never modifies the vocabulary.

## Acceptance criteria

1. With fewer than four distinct translations sharing a target language, training cannot be
   started and the panel says what is needed — including when there are four or more
   entries but some share a translation.
2. A card shows one saved entry's original text and exactly four options: its own
   translation plus three from other entries with the same target language.
3. Across a session the correct option's position varies — it is not always in one place.
4. Choosing the correct option marks it correct; choosing a wrong one marks it wrong and
   also marks the correct one.
5. After an answer, further clicks on options change nothing.
6. Options never contain duplicate texts, and never contain a wrong option whose text
   equals the correct answer.
7. An original or option longer than the card's limit is shown shortened with an
   indication that it continues; activating it expands it fully and activating it again
   collapses it, in both the unanswered and answered states, without submitting an answer.
8. A session ends with a count of correct answers out of the number of cards, and can be
   left at any point, returning to the vocabulary list.
9. The trainer issues no network request and does not modify any saved entry.
