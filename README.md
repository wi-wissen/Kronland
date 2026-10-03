# Kronland

Aufbau-Strategiespiel im Browser nach dem Vorbild von *Die Siedler – Das Erbe der Könige*.
Desktop und Handy, Einzelspieler gegen Computergegner, Multiplayer vorbereitet.
Arbeitstitel; Name, Grafiken und Texte sind eigene.

## Starten

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Simulationstests (Vitest)
npm run test:e2e  # Oberflächentests Desktop + Handy (Playwright)
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

## Spielen

- Im Startmenü Gegnerzahl (1–3), Stärke, Helden und Karte wählen.
- Direktstart per Adresse: `?seed=42&ai=hard&players=3&hero=hedda`
- Grafikstufe: automatisch (Handy/ohne Grafikkarte niedrig, Desktop hoch), erzwingbar per `?quality=low|medium|high`
  (wird gemerkt; im Code: `setQuality()` aus `src/render/quality.js`).
- Karten werden aus dem Seed erzeugt: Hügel, Täler, Gebirge mit Gipfeln, Flüsse mit Furten, Seen, Küsten.
  Steilhänge und Gipfel (Klippen) sind unpassierbar und nicht bebaubar. Größen 96/128/160 (`generateMap(seed, { size })`).
- Auf dem Handy als App installierbar (PWA); der Spielcode ist danach offline verfügbar.
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
node scripts/trim-animations.mjs public/models/characters/*.glb
```

Zuordnung Spieltyp → Modell: `src/render/assets.js`. Ohne Modelle zeigt das Spiel prozedurale Platzhalter.

## Dokumentation

- [Spielregeln](docs/SPIELREGELN.md)
- [Architektur](docs/ARCHITEKTUR.md)
- [Lizenzen und Danksagung](CREDITS.md)
