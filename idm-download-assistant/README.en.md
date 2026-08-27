# IDM Download Assistant Help

## Features

IDM Download Assistant scans attachment links from web pages, repairs common Chinese filename mojibake, and prepares selected links for batch download through the IDM browser extension.

It is useful for announcement, procurement, approval, public notice, and document-download pages that contain PDF, Word, Excel, PPT, DWG, archive, and similar attachments.

Main features:

- Scan attachments on the current page.
- Scan multiple parent list pages starting from the current page.
- Sniff level-1, level-2, and level-3 web pages.
- Limit how many level-2 pages are opened from each parent page, and how many level-3 pages are opened from each level-2 page.
- Repair some Chinese mojibake, URL-encoded names, and server-generated filenames.
- Edit filenames directly.
- Use reversible prefix and suffix options.
- Prepare selected links for IDM batch download.
- Export TXT, CSV, and Excel.
- Remember the minimized state across pages.

## Usage

Open a page that contains attachments. The `IDM Download Assistant` panel appears on the right side.

The first row sets the sniffing range:

- `Scan 1 list page(s)`: how many parent list pages to scan, starting from the current list page.
- `Sniff depth`: `Level 1` scans only list pages; `Level 2` enters detail pages; `Level 3` enters one more linked level.
- `Per-level max N child page(s)`: the maximum level-2 pages per parent list page, and the maximum level-3 pages per level-2 page.

The second row runs the main actions:

- `Start sniffing`: scan attachments with the current settings.
- `Copy selected → IDM`: copy selected links and repaired filenames.
- `Prepare IDM extension`: create a link area that the IDM browser extension can use.
- `Support author`: open the author support page.
- `Help`: open the help page in the current language.

The third row selects and filters results:

- `Select all`
- `Select none`
- `Invert`
- search box
- `Select filtered`

Filenames in the result list can be edited directly. A yellow filename field means the name may be unreliable, such as a server-generated name, hash name, or mojibake.

Prefix and suffix are disabled by default. Check `Prefix` or `Suffix` to apply the input text; uncheck to remove text added by that feature. The suffix is inserted before the extension, for example `filename_published.pdf`.

Recommended IDM workflow:

1. Select the attachments you want to download.
2. Click `Prepare IDM extension`.
3. Right-click inside the blue link area.
4. Choose `Download selected links with IDM` or a similar IDM extension command.
5. Confirm files, save location, and filters in IDM's native batch-download window.

Use `Export TXT`, `Export CSV`, or `Export Excel` to export the current results.

Click `−` in the title bar to minimize the panel into a small icon. Click the icon to restore it. Click `×` to hide the panel on the current page.

## FAQ

### Why cannot it silently download all links directly?

Normal web scripts cannot call IDM's internal client download API directly. The script can only prepare links in a form that the IDM browser extension can recognize, then let IDM open its native batch-download window.

### Why are some filenames mojibake?

Some websites pass filenames through legacy encodings, wrong encodings, URL encoding, or server response headers. The script tries to repair them, but not every site can be fully recovered. Yellow filename fields can be edited manually.

### What does the number of list pages mean?

It means how many parent list pages to scan from the current list page through later pagination. For example, `26` means trying to scan 26 parent pages starting from the current page.

### What does per-level max mean?

It limits child pages, not parent list pages. It means how many level-2 pages each parent page may open, and how many level-3 pages each level-2 page may open.

### Why does Help open different languages?

The script chooses the help file based on the browser language. It currently supports Simplified Chinese, Traditional Chinese, English, Japanese, German, and Russian. Unsupported languages open English help.

## Privacy

The script runs locally in the browser and does not actively upload page content, attachment links, or filenames.

The script reads the current page and may request same-site list pages, detail pages, and attachment URLs to sniff attachments and identify filenames.

External pages are opened only when you click `Help` or `Support author`.

## License

This script uses the MIT License.

Anyone may use, copy, modify, merge, publish, and distribute this script, but the original author and source attribution must be kept.

Source: `https://github.com/Alendarker/AlenDark_scripts`
