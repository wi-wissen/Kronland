# Kronland

Aufbau-Strategiespiel im Browser nach dem Vorbild von *Die Siedler – Das Erbe der Könige*.
Desktop und Handy, Einzelspieler gegen Computergegner, Multiplayer vorbereitet.
Arbeitstitel; Name, Grafiken und Texte sind eigene.

## Starten

```bash
npm install
npm run dev     # Entwicklungsserver: Startseite /, Spiel /play/, Handbuch /manual/, Wiki /compendium/
npm test        # Simulationstests (Vitest)
npm run test:e2e  # Oberflächentests Desktop + Handy (Playwright); anderer Port: E2E_PORT=4204 npm run test:e2e
npm run build   # Produktionsbuild nach dist/ (statische Website, alle Pfade relativ)
```

## Website

| Adresse | Inhalt |
|---|---|
| `./` | Startseite: Titelbild, Funktionen, Galerie, „Für die Schule“ (Entwicklermodus), Danksagung |
| `play/` | das Spiel (URL-Parameter wie unten, z. B. `play/?seed=42`; PWA mit Start `play/`) |
| `manual/` | Anwenderhandbuch DE/EN mit Inhaltsverzeichnis, Suche, Druckansicht (Markdown in `src/site/manual/`) |
| `compendium/` | Spielmechanik-Wiki mit Seitenleiste, Suche, Deep-Links – alle Tabellen aus `src/sim/data/` erzeugt, neue Inhalte erscheinen automatisch |

Aufbau, Erweitern von Handbuch und Wiki, Pfade und PWA: [docs/WEBSITE.md](docs/WEBSITE.md).

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Simulationskern: Karte, Leibeigene, Bauen, Abbau, Zahltag, Determinismus | fertig |
| 2 | 3D-Darstellung und Steuerung (Desktop + Touch) | fertig |
| 3 | Arbeiter, Veredelung, Motivation, Steuern, Forschung | fertig |
| 4 | Militär, Kampf, Türme, Helden, Wetter, Siegbedingung | fertig |
| 5 | Computergegner (Leicht, Normal, Schwer) | fertig |
| 6 | CC0-Modelle (KayKit), Startmenü, Speichern/Laden, PWA, CI | fertig |
| 7 | Missionssystem, Tutorial, Kampagne mit 5 Missionen | fertig |
| 8 | Gebäude-Technologien, Marktplatz, Wetterturm/-kraftwerk, Erfahrung, Brand/Reparatur/Ruinen | fertig |
| 9 | Nebel des Krieges (unerkundet/erkundet/sichtbar, zuletzt gesehene Gebäude, faire KI) | fertig |
| 10 | Erweiterungsinhalte: Wirtshaus, Dieb, Kundschafter, verborgene Lagerstätten, Brücken, Büchsenschützen, Helden Falk/Morla, Brunnen/Denkmal | fertig |
| 11 | Website: Startseite, Spiel unter `play/`, Handbuch, Wiki aus den Spieldaten | fertig |

## Spielen

- **Tutorial**: Ottilie führt in 18 Schritten durch Leibeigene, Bauen, Arbeiter, Forschung und Kampf.
- **Kampagne** „Die Rückkehr der Krone“: fünf Kapitel mit Briefing, Haupt- und Nebenzielen,
  Räubern, Wetter und einem Endkampf gegen Fürst Morwald. Fortschritt und Bestzeiten speichert der Browser.
  Direktstart: `play/?mission=c1` … `play/?mission=c5`, `play/?mission=tutorial`.
- **Freies Spiel**: Im Startmenü Gegnerzahl (1–3), Stärke, Helden, Nebel des Krieges an/aus, Erweiterungsinhalte an/aus und Karte wählen.
- Direktstart per Adresse: `play/?seed=42&ai=hard&players=3&hero=hedda` (ohne Nebel: `&fog=off`, ohne Erweiterung: `&addon=off`)
- **Erweiterungsinhalte** nach Vorbild der Siedler-5-Erweiterungen (Standard an): Wirtshaus mit Dieb (unsichtbar,
  stiehlt, Sprengladungen) und Kundschafter (Fackel, Rohstoffsuche), verborgene Lagerstätten, Brücken an
  Brückenstellen, Büchsenschützen, Helden Falk und Morla, Brunnen und Denkmal. Die KI nutzt sie und wehrt Diebe mit
  Türmen ab. Details: [Erweiterung](docs/ADDON.md), [Spielregeln §13](docs/SPIELREGELN.md#13-erweiterungsinhalte).
- **Nebel des Krieges** wie im Original: Unerkundetes ist schwarz, Erkundetes abgedunkelt mit dem zuletzt
  gesehenen Stand feindlicher Gebäude, Feinde sieht man nur in Sichtweite. Die KI schummelt nicht.
  Sichtweiten und Regeln: [Spielregeln §12](docs/SPIELREGELN.md#12-sicht-und-nebel-des-krieges).
- Grafikstufe: automatisch (Handy/ohne Grafikkarte niedrig, Desktop hoch), erzwingbar per `?quality=low|medium|high`
  (wird gemerkt; im Code: `setQuality()` aus `src/render/quality.js`). Objekte werden je nach Abstand/Zoom
  vereinfacht (Detailstufen), Figuren sind instanziert und GPU-animiert – Details in [Modelle](docs/MODELLE.md).
- Kamera wie ein Kartenprogramm: Ziehen (mittlere Maustaste, ein Finger) greift den Boden, Mausrad und
  Zwei-Finger-Zoom zoomen zum Zeiger bzw. zur Fingermitte, nichts gleitet oder wippt nach.
- Nahzoom bis dicht an Figuren und Gebäude; ganz nah wird der Blick flacher, Figuren und Gebäude bleiben in
  voller Detailstufe ([Architektur](docs/ARCHITEKTUR.md#steuerung)).
- **Entwicklermodus** (auch für den Informatik-Unterricht): Drahtgitter und Detailstufen, A*-Wegsuche Schritt für Schritt,
  Raster-Overlays, Figurenzustände, „Statistik für Nerds“. Einschalten: Einstellungen, `?dev=1` (oder `?debug=1`),
  F3 bzw. Strg+Umschalt+D – siehe [Entwicklermodus](docs/ENTWICKLERMODUS.md).
- Karten werden aus dem Seed erzeugt: Hügel, Täler, Gebirge mit Gipfeln, Flüsse mit Furten, Seen, Küsten.
  Steilhänge und Gipfel (Klippen) sind unpassierbar und nicht bebaubar. Größen 96/128/160 (`generateMap(seed, { size })`).
- **Bauen am Hang**: Mäßige Hänge (bis 4 m Höhenunterschied unter dem Gebäude) werden beim Setzen der Baustelle
  dauerhaft eingeebnet; die Bauvorschau zeigt grün (eben), gelb (wird eingeebnet) oder rot (zu steil).
  Regeln und Recherche: [Spielregeln §6a](docs/SPIELREGELN.md#6a-bauen-am-hang).
- **Spielstände**: beliebig viele im Browser (IndexedDB, komprimiert) mit Vorschaubild, Datum, Spielzeit und Modus;
  speichern, überschreiben, umbenennen, löschen über Menü → „Spiel speichern“ bzw. „Gespeichertes Spiel laden“
  und im Startmenü unter „Spielstände“. „Weiterspielen“ lädt den neuesten Stand. **Autosave** alle 5 Spielminuten
  und beim Verlassen (abschaltbar unter Einstellungen). **Export/Import** als lesbare JSON-Datei
  (`kronland-<name>-<datum>.json`, wahlweise kompakt) – per Dateiauswahl (auch Handy) oder Ziehen & Ablegen.
  Gespeichert wird der vollständige Simulationszustand (inkl. eingeebnetem Gelände), nicht der Entwicklermodus.
  Format, Prüfung und Migration: [Architektur → Spielstände](docs/ARCHITEKTUR.md#spielstände-srcsave).
- Sprache Deutsch/Englisch, Grafikstufe, Lautstärken, Oberflächengröße, Randscrollen und Beschriftungen im Menü „Einstellungen“ (Startmenü und Spielmenü).
- Jedes Symbol ist erklärt: Maus darüber (Desktop) oder **lang drücken** (Handy) zeigt Name, Kosten und Erklärung,
  ohne die Aktion auszulösen. „Beschriftungen anzeigen“ (am Handy standardmäßig an) setzt Kurznamen unter die
  Symbole in Bau-, Heer- und Schnellleiste sowie an die Forschungslinien.
- Auf dem Handy als App installierbar (PWA, startet `play/`); der Spielcode ist danach offline verfügbar.
- Steuerung: siehe [Architektur](docs/ARCHITEKTUR.md#steuerung) oder Menü → „Steuerung anzeigen“.

## KI gegen KI

```bash
node scripts/ai-match.js 1 60 hard easy   # Seed, Minuten, Stärke Spieler 1 und 2
node scripts/ai-match.js 1 60 hard easy --addon   # mit Erweiterungsinhalten
```

## Modelle neu erzeugen

Die verwendeten Modelle liegen fertig in `public/models/`. Zum Neuerzeugen die beiden KayKit-Pakete
von GitHub holen (`KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`,
`KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`) und dann:

```bash
scripts/build-assets.sh <Pfad Hexagon-Paket> <Pfad Figuren-Paket>
```

Das Skript optimiert die Modelle, kürzt die Figuren-Animationen auf die im Manifest genannten Clips
(`scripts/trim-animations.mjs`) und erzeugt die Detailstufen `*.lod1.glb`, `*.lod2.glb` (`scripts/build-lods.mjs`).
Zuordnung Gebäudetyp → Modell: `src/render/assets.js`; Figuren: `public/models/characters/manifest.json`.
Eigene Figuren (z. B. aus Tripo) einbauen: [docs/MODELLE.md](docs/MODELLE.md).
Ohne Modelle zeigt das Spiel prozedurale Platzhalter.

Die bunten Symbole (Rohstoffe, Gebäude, Einheiten …) stammen aus einem Sprite-Atlas, den ein Bildmodell
(OpenRouter, `openai/gpt-5.4-image-2`) im Stil der Figuren gemalt hat. Neu erzeugen mit
`scripts/icons/` – Ablauf in [docs/SYMBOLE.md](docs/SYMBOLE.md).

## Dokumentation

- [Spielregeln](docs/SPIELREGELN.md)
- [Erweiterungsinhalte: Recherche, Auswahl, Technik](docs/ADDON.md)
- [Architektur](docs/ARCHITEKTUR.md)
- [Missionen schreiben](docs/MISSIONEN.md)
- [Modelle, Figuren, Detailstufen](docs/MODELLE.md)
- [Symbole aus dem Bildmodell (Atlas, Prompts, Neuerzeugung)](docs/SYMBOLE.md)
- [Stilreferenz für Figuren und Symbole](docs/STILREFERENZ.md)
- [Ton: Effekte, Musik, eigene Audiodateien](docs/AUDIO.md)
- [Entwicklermodus: was man zeigen kann, Unterrichtsideen](docs/ENTWICKLERMODUS.md)
- [QA-Bericht: Befunde, Fuzz-/Dauertests, Leistung](docs/QA-BERICHT.md)
- [Website: Seiten, Handbuch und Wiki erweitern](docs/WEBSITE.md)
- [Lizenzen und Danksagung](CREDITS.md)
