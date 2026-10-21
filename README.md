# Tessera

A calm, infinite canvas for ideas, references and plans — a free, private alternative to visual board apps.

**Features:** notes (with bold, italic, headings, lists), to-do lists, links, images, sticky notes, headings, sketches, tables, color swatches, YouTube and Vimeo videos, files with PDF previews, voice memos, image cropping and captions, color extraction, web image clipping, a fullscreen gallery, tags with filtering, board icons and covers, templates (built-in and your own), nested boards, columns, arrows between cards, undo/redo, copy/paste, colors, light and dark mode, global search and command palette (Ctrl K), pinned and recent boards, move cards between boards (or drag onto a board), a 30-day Trash, auto-backup to a folder, a storage meter with image compression, frames, snapping and alignment guides, align/distribute/tidy, locking, curved and labeled arrows, a minimap, canvas backgrounds, backup export/import, due dates on to-dos with a Due soon overview, Kanban mode, presentation mode (frames become slides), focus mode, export to PNG, PDF and Markdown, shareable board files, view-only share links, print layouts, version history for every board, 22 light and dark themes (including soft patterned "Design" themes like Paper grain, Sakura, Starry night and Blueprint) with 12 accent colors plus a custom accent picker, a full color picker for swatches, an illustration studio with pressure-sensitive brushes, stabilizer, layers, blend modes, alpha lock, fill, lasso and transform (best with a Wacom, Huion, XP-Pen, Surface Pen or S Pen), optional subtle sounds, a guided tour, a customizable dock, shot list and storyboard cards (with CSV export), font cards, before/after comparison cards, aspect-ratio frames with safe-area guides, grouping, smart arrows that route around cards, collapsible columns and frames, privacy locks for boards, archived boards, a storage health check, backup reminders, optional sync through a Google Drive or OneDrive folder, a start screen with live board thumbnails, a built-in guide and FAQ (press ?), your own heading font (uploaded font files work offline and on phones), shapes, lines and symbols for diagrams and flowcharts, OpenStreetMap map cards with pins and offline snapshots, to-scale floor plans with ready-made layouts, box select, groups, copy and paste, curved walls, table shapes and seat counts, highlighted code blocks with automatic code paste, text fonts, colors, highlights, alignment (left, center, right and justified) and emoji in notes, any heading size, stretchable image frames, arrows from any side of a card, smooth zoom, live clock and date cards with time zones and custom fonts, 81 searchable templates (including bug reports, patch notes and release checklists) for creatives, video, students, teachers, healthcare, developers, events and everyday life, offline support, and install-as-app on Windows, Android, Mac and iPad.

## Your data stays on your device

There are no accounts and no sync. Boards are saved in the browser on the device you use. Clearing site data, uninstalling the app or using a private window erases them, so **export a backup** (Ctrl S) regularly, or turn on **auto-backup to a folder** from the storage chip (Chrome and Edge on a computer). Backups can be imported on any device.

To show a board to someone without sending a file, use **Export & share → Share link** (Ctrl E) and copy the link. Whoever opens it sees a read-only copy they can pan, zoom, open nested boards in and present. Nothing is uploaded: the board is compressed into the part of the link after the `#`, which browsers never send to a server. Because it all lives in the link, images, files and voice memos aren't included (they appear as placeholders), locked boards are left out, and very large boards may not fit, so use a board file for those. A link is a snapshot, so later edits don't change it. The link opens inside a sandboxed frame that can't touch the viewer's own boards, and **Save a copy** in the viewer downloads a board file they can import.

To share one board with everything in it, use **Export & share → Board file** (Ctrl E). The other person opens Tessera and chooses **Import a board** (or drops the file on the canvas). It's added as a new board and nothing of theirs is replaced.

### Optional: sync between computers

In **Storage & backup**, turn on auto-backup to a folder inside Google Drive, OneDrive or Dropbox, then switch **Sync** on. Do the same with the same folder on your other computer. Tessera never uploads anything itself; your cloud app moves the file, and Tessera offers to load newer boards when it sees them. Works in Chrome and Edge on computers.

Board locks are a privacy lock inside the app, not encryption: backups still contain the board's contents.

## Services Tessera contacts

Tessera works fully offline. A few optional features reach the internet:

- **Map cards** load map tiles from OpenStreetMap (© OpenStreetMap contributors) and search places with OpenStreetMap's Nominatim service, which receives what you type in the map search. A snapshot of each map is saved on your device.
- **Google Fonts** (font cards and heading fonts) load from Google the first time.
- **Link cards** show site icons from Google's favicon service.

## Put it on GitHub Pages

1. Create a new public repository (for example `tessera`).
2. Upload every file in this folder to the root of the repo.
3. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save.
4. After a minute it's live at `https://<your-username>.github.io/tessera/`.

To install it as an app, open that link in Chrome or Edge and choose **Install** (or ⋯ → *Install app* inside Tessera). On Android, use Chrome's menu → *Add to Home screen*.

## Updating

When you change files, bump `VERSION` in `sw.js` (e.g. `tessera-v2`) so installed copies pick up the new version.
