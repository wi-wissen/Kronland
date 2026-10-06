# Rohdateien außerhalb von Git

`assets-src/` enthält die Arbeitsstände der Asset-Pipeline: Konzeptbilder, Bild-Varianten, Stimmproben,
Vergleichsbilder und die zugehörigen Textdateien (`spec.json`, `job.json`, Prompts, Besetzung der Stimmen,
`credits.json` …). Zusammen ~1 500 Dateien mit rund 1,4 GB, fast alles PNG.

**Der Ordner gehört nicht zum Repository** (Eintrag `assets-src/` in `.gitignore`). Der Maintainer hält ihn
lokal vor und sichert ihn selbst. Das Spiel braucht davon nichts – es lädt nur, was in `public/` liegt. Tests
(`npm test`), Build (`npm run build`) und E2E laufen ohne `assets-src/`; die wenigen Prüfungen, die Rohdaten
lesen (Stimmbesetzung in `tests/audio/voices.test.js`, Bogenvorlage in `tests/ui/icons.test.js`), werden
ohne den Ordner übersprungen.

## Welche Skripte den Ordner brauchen

Alle Erzeuger der Pipeline lesen oder schreiben unter `assets-src/`: Figuren und Gebäude
(`scripts/asset-gen/model.mjs`, `building.mjs`, `concept.mjs`, `postprocess.mjs`, `horse.mjs`, `views.mjs`,
`strip-anims.mjs`), Stimmen (`voice.mjs`), Musik (`music.mjs`, außer mit eigenem `MUSIC_RAW`), Boden und Natur
(`ground.mjs`), Bilder (`scripts/art/*.mjs`), Symbole (`scripts/icons/generate.mjs`, `slice.mjs`,
`favicon.py`) und Porträts (`scripts/portraits.py`). Fehlt der Ordner (oder der benötigte Unterordner), brechen
sie sofort mit einem Hinweis auf diese Seite ab (`scripts/require-assets-src.mjs`), statt mitten im Lauf an
einer fehlenden Datei zu scheitern.

## Werkzeug: `scripts/assets-src.mjs`

Das Verzeichnis `assets-src/ARCHIVE.json` hält Pfad, Größe und SHA-256 jeder Rohdatei fest und ordnet sie
einem Teil-Archiv zu (erster Ordner unter `assets-src/`, z. B. `buildings`, `characters`, `voices`).

```bash
node scripts/assets-src.mjs status               # Verzeichnis ↔ Platte: was fehlt, was ist neu oder geändert
node scripts/assets-src.mjs pack                 # Verzeichnis neu schreiben + Teil-Archive in assets-src-archive/
node scripts/assets-src.mjs pack --index-only    # nur ARCHIVE.json
node scripts/assets-src.mjs fetch characters     # Teil-Archiv vom Ablageort laden, entpacken, prüfen (ohne Angabe: alle)
```

Teil-Archive gibt es je Ordner, damit man für eine neue Figur nicht 1,4 GB laden muss. `assets-src-archive/`
steht ebenfalls in `.gitignore`. In der Cloud-Umgebung braucht `fetch` (Node) den Proxy:
`NODE_USE_ENV_PROXY=1 node scripts/assets-src.mjs fetch …`.

## Sichern

Nach neuen Rohdateien aus der Pipeline: `pack`, die geänderten `.tar` an den Ablageort laden und den Ablageort
als `"source"` in `assets-src/ARCHIVE.json` eintragen. Mögliche Ablageorte:

| Weg | Wie | Kosten / Grenzen | Passt, wenn … |
|---|---|---|---|
| **Release-Anhänge** | Teil-Archive als Anhang eines Releases (Tag z. B. `assets-src-2026-10`), `fetch` lädt sie | kostenlos, bis 2 GiB je Datei; Zugriff wie das Repository | Dateien selten gebraucht werden |
| **Objektspeicher** (Cloudflare R2, S3, Backblaze B2) | Archive in einem „Bucket“, Adresse in `source` | kleine Mengen meist frei; braucht Zugangsdaten | viele hochladen, Automationen |
| **Eigene Festplatte / Cloud-Ordner** | `assets-src-archive/*.tar` kopieren | keine | als zweite Kopie immer |

Git LFS kommt nicht in Frage: Es würde jeden Klon und jeden CI-Lauf mit 1,4 GB belasten, obwohl die Rohdateien
nur gebraucht werden, wenn man eine Figur oder ein Gebäude neu erzeugt.

```bash
node scripts/assets-src.mjs pack
gh release create assets-src-2026-10 --title "Rohdateien (assets-src)" --notes "siehe docs/ROHDATEIEN.md" assets-src-archive/*.tar
```

Bei einem privaten Repository braucht der Download eine Anmeldung: `gh release download assets-src-2026-10 -D
assets-src-archive`, dann `tar -xf assets-src-archive/<teil>.tar -C assets-src` und `status`.
