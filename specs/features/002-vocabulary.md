# 002 — Personal vocabulary

Status: implemented (2026-07-15)

## Why

Translation at the point of reading (spec 001) is useful in the moment, but the words
are lost the instant the bubble closes. To learn a language the reader needs to keep the
words they looked up. This feature turns a one-off translation into a saved entry the
user owns, and gives them a place to see and manage everything they have collected — the
foundation the flashcard trainer (spec 003) will draw on.

## User-visible behavior

Saving, from the translation bubble:

- After a successful translation, the bubble offers a "Save to vocabulary" action.
- Choosing it stores the pair (original text + its translation, with both languages) in
  the user's personal vocabulary and the action changes to a "Saved" state.
- If that exact entry is already saved, the bubble shows the "Saved" state immediately
  instead of offering to save again — the same item is never stored twice.
- From the "Saved" state the user can remove the entry again; the action returns to
  "Save to vocabulary".
- Saving is unavailable for the non-result states (already-in-target-language, errors) —
  there is nothing to save.

Viewing and managing, in the side panel:

- The user opens the vocabulary by clicking the extension's toolbar icon, which opens a
  side panel beside the page.
- The panel lists every saved entry, newest first. Each row shows the original text, its
  translation, and the language pair.
- The panel shows how many entries are saved, and an explicit empty state when there are
  none yet.
- The user can delete any entry from the panel; it disappears from the list at once.
- The user can filter the list by typing: only entries whose original text or translation
  contains the typed text remain visible.
- The list stays in sync with saving: an entry saved from the bubble appears in an
  already-open panel without a manual refresh, and an entry deleted in the panel updates
  the bubble's state if that same text is currently shown.
- The saved vocabulary persists across sessions and browser restarts.

## Edge cases and failure behavior

- The same original text saved into two different target languages is two distinct
  entries; deleting one leaves the other.
- Saving works offline — it only writes to local storage and makes no network request.
- Whitespace-only differences in the original text do not create separate entries
  (leading/trailing whitespace is trimmed before comparison).
- Deleting an entry is immediate and does not ask for confirmation; it affects only that
  one entry and only the user's own local data.
- A filter that matches nothing shows a "no matches" state, distinct from the empty
  vocabulary state.

## Contract

- Extends spec 001; the translation bubble gains the save/saved control.
- Requested permissions become exactly: `contextMenus`, `activeTab`, `scripting`,
  `storage`, `sidePanel`. No host permissions; no `unlimitedStorage`.
- The vocabulary lives in local extension storage only; the extension performs no network
  request for this feature.
- A vocabulary entry records: the original text, the translation, the source language,
  the target language, and the time it was added.
- Entry identity — what counts as "the same entry" for de-duplication — is the trimmed
  original text together with the source language and the target language.

## Acceptance criteria

1. Saving a translated result from the bubble adds exactly one entry containing the
   original text, the translation, both language codes, and an added-at timestamp, and
   the bubble switches to the "Saved" state.
2. Attempting to save an entry whose (trimmed original text, source language, target
   language) already exists does not add a second entry; the bubble shows "Saved".
3. Removing a saved entry from the bubble deletes it and returns the control to
   "Save to vocabulary".
4. The save control is absent for the already-in-target-language state and for every
   error state.
5. Clicking the toolbar icon opens the side panel; the panel lists all saved entries
   newest-first with original text, translation, and language pair, plus a total count.
6. With no entries saved, the panel shows a distinct empty state; with entries present
   but none matching the active filter, it shows a distinct no-matches state.
7. Deleting an entry in the panel removes it from the list immediately and from storage.
8. Typing in the filter narrows the list to entries whose original text or translation
   contains the typed text, case-insensitively.
9. An entry saved from the bubble appears in an already-open panel without manual
   refresh, and deleting an entry keeps the bubble's shown state consistent.
10. The same original text saved under two different target languages produces two
    entries; the saved vocabulary is unchanged after a browser restart.
