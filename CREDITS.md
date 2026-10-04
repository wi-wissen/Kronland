# Danksagung und Lizenzen

## 3D-Modelle

- **KayKit Medieval Hexagon Pack 1.0** und **KayKit Character Pack: Adventurers 1.0**
  von Kay Lousberg, [www.kaylousberg.com](https://www.kaylousberg.com) – Lizenz CC0.
  Lizenztexte liegen unter `public/models/`. Erzeugt mit `scripts/build-assets.sh`.

Alle übrigen Modelle (Figuren der Siedler und Soldaten, einige Gebäude) sind prozedural im Code
erzeugt (`src/render/models.js`).

## Symbole

Die bunten Symbole (`public/icons/symbols.webp`) hat das Bildmodell `openai/gpt-5.4-image-2` (über
OpenRouter) für dieses Projekt erzeugt. Vorlage waren die eigenen SVG-Symbole und die eigenen, mit ChatGPT
erstellten Figurenbögen (`assets-src/icons/stil-*.webp`). Ablauf und Prompts: [docs/SYMBOLE.md](docs/SYMBOLE.md).

## Vorbild

Die Spielmechanik orientiert sich an *Die Siedler – Das Erbe der Könige* (Blue Byte, 2004).
Namen, Texte, Helden und Grafiken sind eigene. Zahlenwerte stammen aus der Community-Dokumentation
(dedk.de-Wiki) und sind in `docs/SPIELREGELN.md` belegt.

## Ton

- Alle Klangeffekte und die Musik werden im Spiel prozedural erzeugt (Web Audio API); eigene
  Komposition, keine fremden Aufnahmen. Später ergänzte Audiodateien unter `public/audio/` siehe
  [docs/AUDIO.md](docs/AUDIO.md) – deren Herkunft und Lizenz bitte hier eintragen.
