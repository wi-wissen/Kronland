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
| 5 | Computergegner | offen |
| 6 | Assets, Speichern, PWA, Feinschliff | offen |

## Dokumentation

- [Spielregeln](docs/SPIELREGELN.md)
- [Architektur](docs/ARCHITEKTUR.md)
