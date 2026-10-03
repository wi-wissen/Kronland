# Architektur

```
src/
  sim/        Spiellogik: reines JS, kein DOM, kein Three.js, deterministisch
    data/     Balancing-Werte (Gebäude, Rohstoffe, Einheiten, Techs)
    systems/  Ablauf pro Takt (Bauen, Abbau, Zahltag, …)
  ai/         Computergegner – erzeugt nur Befehle
  render/     Three.js-Darstellung, liest den Zustand der Simulation
  game/       Engine (Spielschleife, Auswahl, Bauvorschau) und Eingabe (Maus, Tastatur, Touch)
  ui/         Vue 3 (Options API): Menüs, Leisten, Panels
tests/        Vitest (Simulation, KI)
e2e/          Playwright (Desktop und Handy-Viewport)
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
4. **Simulation getrennt vom Rendering.** Sie läuft mit festem Takt; der Renderer interpoliert
   zwischen den Takten. Zurzeit im Haupt-Thread (die Rechenlast ist klein); der Umzug in einen
   Web Worker ist vorbereitet, weil die Engine nur über Befehle und Lesezugriffe mit ihr spricht.
5. **Vue fasst keine Three-Objekte an.** Die Engine ist eine eigene Klasse; Vue bekommt nur
   einen kleinen reaktiven Ausschnitt (Rohstoffe, Auswahl), wenige Male pro Sekunde.

## Multiplayer (später)

Lockstep: Alle Clients rechnen dieselbe Simulation, ausgetauscht werden nur Befehle pro Takt.
Ein kleiner WebSocket-Relay genügt. Desyncs erkennt der Zustands-Hash.

## JavaScript mit Typ-Hinweisen

Es ist normales JavaScript. Typen stehen als JSDoc-Kommentare; `jsconfig.json` aktiviert die
Prüfung im Editor, ohne Build-Schritt.

## Steuerung

| | Desktop | Touch |
|---|---|---|
| Auswählen | Linksklick, Rahmen ziehen, Shift fügt hinzu | Tippen |
| Befehl (laufen, bauen, abbauen) | Rechtsklick | Tippen mit Auswahl |
| Kamera verschieben | WASD/Pfeile, mittlere Taste ziehen | 1 Finger ziehen |
| Kamera drehen | Q/E, Einfg/Entf, rechte Taste ziehen | 2 Finger drehen |
| Zoomen | Mausrad, Bild↑/↓ | 2 Finger spreizen |
| Bauen | Baumenü, Klick setzt, Rechtsklick bricht ab | Baumenü, Tippen, „Hier bauen“ |
| Untätige Leibeigene | Taste . | Knopf „Untätige“ |
| Pause | Leertaste | Knopf |
