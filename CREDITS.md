# Danksagung und Lizenzen

## 3D-Modelle

- **KayKit Medieval Hexagon Pack 1.0** und **KayKit Character Pack: Adventurers 1.0**
  von Kay Lousberg, [www.kaylousberg.com](https://www.kaylousberg.com) – Lizenz CC0.
  Lizenztexte liegen unter `public/models/`. Erzeugt mit `scripts/build-assets.sh`.

- **Selbst generierte Figuren** (Leibeigener, Leibeigene, weitere folgen): Konzeptbilder mit ChatGPT bzw.
  OpenRouter-Bildmodellen (Google Gemini 3 Pro Image) erstellt und bearbeitet, 3D-Modell, Rig und Animationen
  mit [Meshy](https://www.meshy.ai) (Mehransichten → 3D, Auto-Rig, Animationsbibliothek, Text → Bewegung),
  Nachbearbeitung mit eigenen Skripten (`scripts/asset-gen/`). Eigene Erzeugnisse des Projekts.
  Herkunft je Figur – Konzeptbögen, Prompts (`concept.json`), Meshy-Task-IDs (`job.json`) und Vorschauen –
  unter `assets-src/characters/<id>/`. Werkzeuge (Axt, Hammer, Spitzhacke) prozedural (`scripts/asset-gen/props.mjs`).
- **Konzeptbögen der Helden** (Nelia, Orrin, Taran, Malvor): mit OpenRouter (`openai/gpt-5.4-image-2`) im Stil
  der Leibeigenen erzeugt, Prompts in `assets-src/characters/hero-prompts.json` und je Figur in `concept.json`.
  Eigene Erzeugnisse des Projekts; die 3D-Figuren folgen.

Alle übrigen Modelle (Figuren der Soldaten als Rückfall, einige Gebäude) sind prozedural im Code
erzeugt (`src/render/models.js`).

## Bodentexturen

Gras, Wiese, Erde, Sand, Fels und Schnee (`public/textures/ground/`) haben die Bildmodelle `openai/gpt-image-2` und
`bytedance-seed/seedream-5-0-flash` (über OpenRouter) für dieses Projekt erzeugt. Nahtlos gemacht und farblich
angeglichen mit eigenen Skripten (`scripts/asset-gen/ground.mjs`). Prompts, Modelle, Kosten und alle Kandidaten:
`assets-src/ground/`, Ablauf in [docs/BODEN.md](docs/BODEN.md).

## Symbole

Die bunten Symbole (`public/icons/symbols.webp`) hat das Bildmodell `openai/gpt-5.4-image-2` (über
OpenRouter) für dieses Projekt erzeugt. Vorlage waren die eigenen SVG-Symbole und die eigenen, mit ChatGPT
erstellten Figurenbögen (`assets-src/icons/stil-*.webp`). Ablauf und Prompts: [docs/SYMBOLE.md](docs/SYMBOLE.md).
Favicon und App-Icons (`public/favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) sind die
Krone aus diesem Bogen, freigestellt von `scripts/icons/favicon.py`.

## Porträts

- `public/portraits/serf.webp` und `worker.webp`: Ausschnitte aus den eigenen Figurenbögen
  (`assets-src/icons/style-1.webp`, `style-2.webp`); die Platzhalter-Spielerfarbe ist auf Spieler-Blau umgefärbt.

## Vorbild

Die Spielmechanik orientiert sich an *Die Siedler – Das Erbe der Könige* (Blue Byte, 2004).
Namen, Texte, Helden und Grafiken sind eigene. Zahlenwerte stammen aus der Community-Dokumentation
(dedk.de-Wiki) und sind in `docs/SPIELREGELN.md` belegt.

## Ton

- Alle Klangeffekte und die Musik werden im Spiel prozedural erzeugt (Web Audio API); eigene
  Komposition, keine fremden Aufnahmen. Später ergänzte Audiodateien unter `public/audio/` siehe
  [docs/AUDIO.md](docs/AUDIO.md) – deren Herkunft und Lizenz bitte hier eintragen.
