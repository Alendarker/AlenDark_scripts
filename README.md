# AlenDark Scripts

A collection of practical browser userscripts by AlenDark.

This repository currently contains one script: **IDM Download Assistant**.

## Scripts

| Script | Description | Script file | Help |
| --- | --- | --- | --- |
| IDM Download Assistant | Scans current pages, paginated list pages, and deeper linked pages for attachments; repairs common filename issues; prepares selected links for IDM batch download. | [idm-download-assistant.js](idm-download-assistant/idm-download-assistant.js) | [Help](idm-download-assistant/README.en.md) |

## IDM Download Assistant

IDM Download Assistant is a Tampermonkey userscript for collecting attachment links from web pages and preparing them for Internet Download Manager.

It is useful for pages that contain downloadable PDFs, Word documents, Excel files, drawings, archives, and similar attachments.

Main capabilities:

- Scan attachments on the current page.
- Scan multiple parent list pages from the current page.
- Sniff level-1, level-2, and level-3 web pages.
- Repair some Chinese filename mojibake, URL-encoded names, and server-generated filenames.
- Edit filenames directly before sending links to IDM.
- Add reversible prefix and suffix text to filenames.
- Prepare selected links for IDM browser-extension batch download.
- Export results as TXT, CSV, or Excel.
- Open help in the browser language when supported.

## Links

- Script: [idm-download-assistant/idm-download-assistant.js](idm-download-assistant/idm-download-assistant.js)
- Raw script: [raw.githubusercontent.com](https://raw.githubusercontent.com/Alendarker/AlenDark_scripts/main/idm-download-assistant/idm-download-assistant.js)
- Help: [English](idm-download-assistant/README.en.md), [简体中文](idm-download-assistant/README.md), [繁體中文](idm-download-assistant/README.zh-TW.md), [日本語](idm-download-assistant/README.ja.md), [Deutsch](idm-download-assistant/README.de.md), [Русский](idm-download-assistant/README.ru.md)
- License: [MIT License](idm-download-assistant/LICENSE)

## License

Unless a script states otherwise, scripts in this repository are released under the MIT License.

You may use, copy, modify, publish, and distribute the scripts, but you must keep the original author and source attribution.

Source: `https://github.com/Alendarker/AlenDark_scripts`
