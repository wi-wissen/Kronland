# Architektur

```
src/
  sim/        Spiellogik: reines JS, kein DOM, kein Three.js, deterministisch
    data/     Balancing-Werte (Gebäude, Rohstoffe, Einheiten, Techs)
    systems/  Ablauf pro Takt (Bauen, Abbau, Zahltag, …)
  ai/         Computergegner – erzeugt nur Befehle
  render/     Three.js-Darstellung, liest Snapshots der Simulation
  ui/         Vue 3 (Options API): Menüs, Leisten, Panels
tests/        Vitest (Simulation, KI), später Playwright (E2E)
docs/         Spielregeln und Architektur
```

## Leitregeln

1. **Befehle sind der einzige Eingang.** Spieler, KI und später Netzwerk-Mitspieler schicken
   Befehle wie `{ type: 'placeBuilding', player, building, x, y }`. Die Simulation prüft sie
   und wendet sie im nächsten Takt an.
2. **Determinismus.** Gleicher Seed + gleiche Befehle = gleicher Zustand, auf jedem Browser.
   - fester Takt (100 ms), nur Ganzzahlen in der Logik (Positionen in 1/1000 Kachel),
   - eigener Zufallsgenerator (`sim/rng.js`), kein `Math.random`, kein `Date.now`,
   - keine `Math.sin/cos/atan2` in der Logik (Lookup-Tabellen in `sim/fixed.js`),
   - feste Iterationsreihenfolge (Entities nach ID).
   - `sim/hash.js` bildet pro Takt einen Zustands-Hash; Golden-Tests sichern das ab.
3. **Grafik austauschbar.** Die Simulation kennt nur Typen (`residence`, Stufe 2). Welches Modell
   gezeigt wird, steht in einer Zuordnung im Renderer.
4. **Simulation im Web Worker.** Der Haupt-Thread rendert und interpoliert zwischen Snapshots.
5. **Vue fasst keine Three-Objekte an.** Die Engine ist eine eigene Klasse; Vue bekommt nur
   einen kleinen reaktiven Ausschnitt (Rohstoffe, Auswahl), wenige Male pro Sekunde.

## Multiplayer (später)

Lockstep: Alle Clients rechnen dieselbe Simulation, ausgetauscht werden nur Befehle pro Takt.
Ein kleiner WebSocket-Relay genügt. Desyncs erkennt der Zustands-Hash.

## JavaScript mit Typ-Hinweisen

Es ist normales JavaScript. Typen stehen als JSDoc-Kommentare; `jsconfig.json` aktiviert die
Prüfung im Editor, ohne Build-Schritt.
