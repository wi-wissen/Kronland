# Kronland

Aufbau-Strategiespiel im Browser nach dem Vorbild von *Die Siedler – Das Erbe der Könige*.
Desktop und Handy, Einzelspieler gegen Computergegner, Multiplayer vorbereitet.
Arbeitstitel; Name, Grafiken und Texte sind eigene.

## Starten

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Simulationstests (Vitest)
npm run test:e2e  # Oberflächentests Desktop + Handy (Playwright); anderer Port: E2E_PORT=4204 npm run test:e2e
npm run build   # Produktionsbuild nach dist/
```

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

## Spielen

- **Tutorial**: Ottilie führt in 18 Schritten durch Leibeigene, Bauen, Arbeiter, Forschung und Kampf.
- **Kampagne** „Die Rückkehr der Krone“: fünf Kapitel mit Briefing, Haupt- und Nebenzielen,
  Räubern, Wetter und einem Endkampf gegen Fürst Morwald. Fortschritt und Bestzeiten speichert der Browser.
  Direktstart: `?mission=c1` … `?mission=c5`, `?mission=tutorial`.
- **Freies Spiel**: Im Startmenü Gegnerzahl (1–3), Stärke, Helden, Nebel des Krieges an/aus und Karte wählen.
- Direktstart per Adresse: `?seed=42&ai=hard&players=3&hero=hedda` (ohne Nebel: `&fog=off`)
- **Nebel des Krieges** wie im Original: Unerkundetes ist schwarz, Erkundetes abgedunkelt mit dem zuletzt
  gesehenen Stand feindlicher Gebäude, Feinde sieht man nur in Sichtweite. Die KI schummelt nicht.
  Sichtweiten und Regeln: [Spielregeln §12](docs/SPIELREGELN.md#12-sicht-und-nebel-des-krieges).
- Grafikstufe: automatisch (Handy/ohne Grafikkarte niedrig, Desktop hoch), erzwingbar per `?quality=low|medium|high`
  (wird gemerkt; im Code: `setQuality()` aus `src/render/quality.js`). Objekte werden je nach Abstand/Zoom
  vereinfacht (Detailstufen), Figuren sind instanziert und GPU-animiert – Details in [Modelle](docs/MODELLE.md).
- Leistungsanzeige: `?debug=1` (Bilder/s, Zeichenaufrufe, Dreiecke, Objekte je Detailstufe).
- Karten werden aus dem Seed erzeugt: Hügel, Täler, Gebirge mit Gipfeln, Flüsse mit Furten, Seen, Küsten.
  Steilhänge und Gipfel (Klippen) sind unpassierbar und nicht bebaubar. Größen 96/128/160 (`generateMap(seed, { size })`).
- Auf dem Handy als App installierbar (PWA); der Spielcode ist danach offline verfügbar.
- Sprache Deutsch/Englisch, Grafikstufe, Lautstärken, Oberflächengröße und Randscrollen im Menü „Einstellungen“ (Startmenü und Spielmenü).
- Steuerung: siehe [Architektur](docs/ARCHITEKTUR.md#steuerung) oder Menü → „Steuerung anzeigen“.

## KI gegen KI

```bash
node scripts/ai-match.js 1 60 hard easy   # Seed, Minuten, Stärke Spieler 1 und 2
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

## Dokumentation

- [Spielregeln](docs/SPIELREGELN.md)
- [Architektur](docs/ARCHITEKTUR.md)
- [Missionen schreiben](docs/MISSIONEN.md)
- [Modelle, Figuren, Detailstufen](docs/MODELLE.md)
- [Ton: Effekte, Musik, eigene Audiodateien](docs/AUDIO.md)
- [QA-Bericht: Befunde, Fuzz-/Dauertests, Leistung](docs/QA-BERICHT.md)
- [Lizenzen und Danksagung](CREDITS.md)
