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

## Stimmen

Alle Stimmen (Missionsdialoge, Sprüche der Figuren) sind für dieses Projekt erzeugt: Stimme aus einer
Beschreibung und Klonen mit ByteDance Seed Audio 1.0 (über OpenRouter), Hörprüfung mit Google Gemini 3.8 Flash.
Vorlagen, Beschreibungen und unbearbeitete Aufnahmen unter `assets-src/voices/`, Ablauf in
[docs/AUDIO.md](docs/AUDIO.md#stimmen). Eigene Erzeugnisse des Projekts, keine echten Sprecher.

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

- Umgebung und die meisten Klangeffekte werden im Spiel prozedural erzeugt (Web Audio API); eigene
  Komposition, ebenso die generative Rückfall-Musik.
- Einige Effekte (Axt, Spitzhacke, Hammer, Klingen, Pfeiltreffer, Münzen) unter
  `public/audio/sfx/` stammen aus **Kenney – RPG Audio** (https://kenney.nl/assets/rpg-audio) und
  **Kenney – Impact Sounds** (https://kenney.nl/assets/impact-sounds), Kenney Vleugels / www.kenney.nl,
  Lizenz **CC0 1.0** (http://creativecommons.org/publicdomain/zero/1.0/). Geschnitten, in der Tonhöhe
  variiert und als MP3 umgewandelt mit `scripts/asset-gen/sfx-cc0.mjs`; Zuordnung in
  [docs/AUDIO.md](docs/AUDIO.md#effekt-aufnahmen-cc0).
- Der Amboss (`public/audio/sfx/anvil-*.mp3`) stammt von Freesound: „Hammer and anvil“ von **Duasun**
  (https://freesound.org/people/Duasun/sounds/321889/) und „Anvil – Lokomo 125 kg – Hammer on 6mm steel 1 time“
  von **ldezem** (https://freesound.org/people/ldezem/sounds/386129/), beide **CC0 1.0**; einzelne Schläge
  geschnitten mit `scripts/asset-gen/sfx-cc0.mjs`.
- Die Musik unter `public/audio/music/` ist für dieses Projekt mit **Google Lyria 3 Pro** (über OpenRouter)
  erzeugt, vorgeprüft mit Google Gemini 3.8 Flash und mit `scripts/asset-gen/music.mjs` geschnitten und in der
  Lautheit angeglichen (Prompts und Auswahl im Skript, Ablauf in [docs/AUDIO.md](docs/AUDIO.md#musik-lyria-3)).
  Eigene Erzeugnisse des Projekts; die Dateien tragen das unhörbare SynthID-Wasserzeichen von Google.
- Weitere Audiodateien unter `public/audio/` bitte hier mit Herkunft und Lizenz eintragen.
