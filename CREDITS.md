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

Alle übrigen Modelle (Figuren der Soldaten als Rückfall, einige Gebäude) sind prozedural im Code
erzeugt (`src/render/models.js`).

## Symbole

Die bunten Symbole (`public/icons/symbols.webp`) hat das Bildmodell `openai/gpt-5.4-image-2` (über
OpenRouter) für dieses Projekt erzeugt. Vorlage waren die eigenen SVG-Symbole und die eigenen, mit ChatGPT
erstellten Figurenbögen (`assets-src/icons/stil-*.webp`). Ablauf und Prompts: [docs/SYMBOLE.md](docs/SYMBOLE.md).

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
