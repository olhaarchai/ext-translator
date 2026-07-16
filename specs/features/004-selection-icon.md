# 004 — Selection icon trigger

Status: implemented (2026-07-16)

## Why

Reaching for the context menu breaks the flow of reading: select, right-click, find the
item, click. A small icon that appears right where the selection ends turns translation
into a single click at the point of attention. The context menu stays as the alternative
path for people who prefer it or who disable the icon.

This is the first feature that requires the extension to run on pages without the user
invoking it first, which is a deliberate trade-off recorded in the contract below.

## User-visible behavior

- Selecting text on an http(s) page makes a small icon appear at the start of the
  selection, anchored to its first line. A multi-line selection puts the icon by its first
  line, not at the far corner of the selected block.
- Clicking the icon opens the same translation bubble the context menu opens, for the
  selected text.
- The icon disappears when the selection is cleared, when the bubble opens, when the user
  presses Escape, when the page is scrolled or resized, and when the user clicks
  elsewhere.
- The icon never appears for an empty or whitespace-only selection, and never for a
  selection made inside the extension's own bubble.
- The "Translate selection" context-menu item keeps working exactly as before.
- The side panel offers a switch to turn the icon off. With the icon off, selecting text
  shows nothing and only the context menu triggers translation. The choice persists
  across sessions.

## Edge cases and failure behavior

- Repeated selections never leave more than one icon on the page; changing the selection
  moves the single icon rather than adding another.
- The icon is rendered in isolation from the page: page styles do not affect it, its
  styles do not leak out, and the page's own content and layout are never modified.
- The icon positions itself with the selection, so it stays anchored to the text rather
  than to the viewport.
- The icon appears only in the page's top-level document, not inside embedded frames.
- On pages already open when the extension is installed or updated, the icon starts
  working after those pages are reloaded; the context menu keeps working there
  immediately.

## Contract

- The extension runs a content script automatically on all http(s) pages in the top
  frame. This supersedes the "no host permissions" clause in specs 001 and 002 (spec 001
  also said "page access happens only on explicit user invocation"): the extension now has
  access to page content on every http(s) page, and the browser shows the corresponding
  permission warning at install time.
- Requested permissions become exactly: `contextMenus`, `activeTab`, `scripting`,
  `storage`, `sidePanel`, plus automatic content-script matches on `http://*/*` and
  `https://*/*`.
- The privacy invariant is unchanged and still holds: the extension performs no network
  request. Selected text is read locally, only to translate it on-device, and is never
  transmitted anywhere.
- The icon reads the selection only to know it exists, where it is, and what it says when
  the user clicks; nothing is stored unless the user saves a translation (spec 002).

## Acceptance criteria

1. Selecting non-empty text on an http(s) page shows exactly one icon anchored to the
   start of the selection, including when the selection spans several lines.
2. Clicking the icon opens the translation bubble for the selected text, matching what the
   context menu produces for the same selection.
3. An empty or whitespace-only selection shows no icon.
4. Clearing the selection hides the icon; scrolling, resizing, pressing Escape, or opening
   the bubble also hides it.
5. Making a new selection while an icon is showing results in one icon, not two.
6. A selection made inside the extension's own bubble does not produce an icon.
7. With the icon switched off in the side panel, no icon appears for any selection, the
   setting persists across sessions, and the context menu still opens the bubble.
8. The feature issues no network request.
