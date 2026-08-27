# IDM-Download-Assistent Hilfe

## Funktionen

Der IDM-Download-Assistent erkennt Anhangslinks auf Webseiten, repariert häufige Mojibake-Probleme bei chinesischen Dateinamen und bereitet ausgewählte Links für den Stapeldownload über die IDM-Browsererweiterung vor.

Geeignet ist er für Bekanntmachungen, Ausschreibungen, Genehmigungen, öffentliche Hinweise und Downloadseiten mit PDF-, Word-, Excel-, PPT-, DWG- und Archivanhängen.

Hauptfunktionen:

- Anhänge auf der aktuellen Seite scannen.
- Mehrere übergeordnete Listenseiten ab der aktuellen Seite scannen.
- Webseiten der Ebene 1, 2 und 3 durchsuchen.
- Begrenzen, wie viele Ebene-2-Seiten pro übergeordneter Seite und wie viele Ebene-3-Seiten pro Ebene-2-Seite geöffnet werden.
- Einige chinesische Mojibake-, URL-kodierte und servergenerierte Dateinamen reparieren.
- Dateinamen direkt bearbeiten.
- Rücknehmbare Präfixe und Suffixe verwenden.
- Links für IDM-Stapeldownload vorbereiten.
- TXT, CSV und Excel exportieren.
- Minimierten Zustand seitenübergreifend speichern.

## Verwendung

Öffnen Sie eine Seite mit Anhängen. Rechts erscheint das Panel `IDM-Download-Assistent`.

Die erste Zeile legt den Suchbereich fest:

- `1 Listenseite scannen`: Anzahl der übergeordneten Listenseiten ab der aktuellen Listenseite.
- `Suchtiefe`: `Ebene 1` scannt nur Listenseiten; `Ebene 2` öffnet Detailseiten; `Ebene 3` öffnet eine weitere Ebene.
- `Pro Ebene maximal N Unterseiten`: maximale Ebene-2-Seiten pro übergeordneter Listenseite und maximale Ebene-3-Seiten pro Ebene-2-Seite.

Die zweite Zeile enthält die Hauptaktionen:

- `Suche starten`: Anhänge mit den aktuellen Einstellungen scannen.
- `Auswahl kopieren → IDM`: ausgewählte Links und reparierte Dateinamen kopieren.
- `IDM-Erweiterung vorbereiten`: einen Linkbereich erstellen, den die IDM-Browsererweiterung verwenden kann.
- `Autor unterstützen`: Unterstützungsseite des Autors öffnen.
- `Hilfe`: Hilfeseite in der aktuellen Sprache öffnen.

Die dritte Zeile wählt und filtert Ergebnisse:

- `Alle auswählen`
- `Keine auswählen`
- `Auswahl umkehren`
- Suchfeld
- `Gefilterte auswählen`

Dateinamen in der Ergebnisliste können direkt bearbeitet werden. Ein gelbes Dateinamenfeld bedeutet, dass der Name möglicherweise unzuverlässig ist, zum Beispiel servergeneriert, ein Hash-Name oder Mojibake.

Präfix und Suffix sind standardmäßig deaktiviert. Aktivieren Sie `Präfix` oder `Suffix`, um den eingegebenen Text anzuwenden; deaktivieren Sie die Option, um die von dieser Funktion hinzugefügten Inhalte zu entfernen. Das Suffix wird vor der Dateiendung eingefügt, zum Beispiel `dateiname_veroeffentlicht.pdf`.

Empfohlener IDM-Ablauf:

1. Wählen Sie die Anhänge aus, die Sie herunterladen möchten.
2. Klicken Sie auf `IDM-Erweiterung vorbereiten`.
3. Klicken Sie mit der rechten Maustaste in den blauen Linkbereich.
4. Wählen Sie in der IDM-Erweiterung `Ausgewählte Links mit IDM herunterladen` oder einen ähnlichen Befehl.
5. Bestätigen Sie Dateien, Speicherort und Filter im nativen IDM-Stapeldownloadfenster.

Mit `TXT exportieren`, `CSV exportieren` oder `Excel exportieren` können Sie die aktuellen Ergebnisse exportieren.

Klicken Sie in der Titelleiste auf `−`, um das Panel zu einem kleinen Symbol zu minimieren. Klicken Sie auf das Symbol, um es wiederherzustellen. Klicken Sie auf `×`, um das Panel auf der aktuellen Seite auszublenden.

## FAQ

### Warum kann das Skript nicht alle Links direkt still herunterladen?

Normale Webseiten-Skripte können die interne Download-API des IDM-Clients nicht direkt aufrufen. Das Skript kann Links nur so vorbereiten, dass die IDM-Browsererweiterung sie erkennt und das native Stapeldownloadfenster öffnet.

### Warum sind manche Dateinamen Mojibake?

Einige Websites übergeben Dateinamen über alte Kodierungen, falsche Kodierungen, URL-Kodierung oder Server-Antwortheader. Das Skript versucht eine Reparatur, kann aber nicht jede Website vollständig wiederherstellen. Gelbe Dateinamenfelder können manuell bearbeitet werden.

### Was bedeutet die Anzahl der Listenseiten?

Sie gibt an, wie viele übergeordnete Listenseiten ab der aktuellen Listenseite über die weitere Seitennavigation gescannt werden. `26` bedeutet zum Beispiel, dass ab der aktuellen Seite 26 übergeordnete Seiten versucht werden.

### Was bedeutet das Maximum pro Ebene?

Es begrenzt Unterseiten, nicht übergeordnete Listenseiten. Es legt fest, wie viele Ebene-2-Seiten pro Elternseite und wie viele Ebene-3-Seiten pro Ebene-2-Seite geöffnet werden.

### Warum öffnet Hilfe unterschiedliche Sprachen?

Das Skript wählt die Hilfedatei anhand der Browsersprache. Unterstützt werden vereinfachtes Chinesisch, traditionelles Chinesisch, Englisch, Japanisch, Deutsch und Russisch. Nicht unterstützte Sprachen öffnen die englische Hilfe.

## Datenschutz

Das Skript läuft lokal im Browser und lädt Seiteninhalt, Anhangslinks oder Dateinamen nicht aktiv hoch.

Zur Erkennung von Anhängen und Dateinamen liest das Skript die aktuelle Seite und kann Listenseiten, Detailseiten und Anhangs-URLs derselben Website anfragen.

Externe Seiten werden nur geöffnet, wenn Sie `Hilfe` oder `Autor unterstützen` anklicken.

## Lizenz

Dieses Skript verwendet die MIT License.

Jeder darf dieses Skript verwenden, kopieren, ändern, zusammenführen, veröffentlichen und verteilen, muss aber den ursprünglichen Autor und die Quelle nennen.

Quelle: `https://github.com/Alendarker/AlenDark_scripts`
