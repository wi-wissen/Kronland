---
title: Wirtschaft
date: 2026-10-03T12:17:09+02:00
teaser: Arbeiter, die essen und schlafen, Werkstätten, Steuern und Forschung: die Wirtschaftsschleife des Vorbilds in einem Schritt – gebaut aus Zustandsautomaten und Datentabellen.
milestone: true
---

## Was entstand {#what}

Neun Minuten nach der ersten 3D-Fassung wird aus Leibeigenen und Rohstoffen eine Wirtschaft: Arbeiter mit
Arbeitsplatz, Wohnhaus und Bauernhof, Minen, Veredelung in Werkstätten, Motivation, Steuern, Forschung und der Ausbau
von Gebäuden in Stufen. Dazu kommen 20 neue Tests und ein Infofenster für Gebäude.

![Nach zehn Minuten Spielzeit: Wohnhäuser, Bauernhöfe mit Feldern, Hochschule, Lehm- und Steinmine. Die Gebäude hat ein kleines Testskript mit denselben Befehlen gesetzt, die auch ein Mensch schicken würde.](blog/economy/settlement.webp)

## Der Wirtschaftskreislauf {#loop}

Das Vorbild hat eine klare Schleife, und Kronland übernimmt sie:

1. **Leibeigene** (für Taler gekauft) bauen Gebäude und bauen Rohstoffe an Haufen ab – Holz, Lehm, Stein, Eisen,
   Schwefel.
2. Steht eine Werkstatt oder Mine, zieht aus dem **Dorfzentrum** ein **Arbeiter** zu. Arbeiter kann man nicht
   steuern; sie gehen ihrem Beruf nach.
3. **Minen** fördern Rohstoffe; **Veredler** (Ziegelei, Sägewerk, Steinmetz, Schmiede, Alchimist) machen daraus
   wertvollere Güter.
4. Arbeiter brauchen **Essen** (Bauernhof) und **Schlaf** (Wohnhaus) – sonst rasten sie am Lagerfeuer, und das dauert.
5. Alle zwei Minuten ist **Zahltag**: Arbeiter zahlen Steuern, und davon kauft man neue Leibeigene, Gebäude und
   Forschung.

Das Spannende daran ist die [Rückkopplung](https://de.wikipedia.org/wiki/R%C3%BCckkopplung): Mehr Arbeiter bringen mehr
Steuern, brauchen aber mehr Betten und Essplätze. Hohe Steuern bringen mehr Geld, senken aber die Motivation – und wer
zu unzufrieden ist, zieht weg. Ein gutes Aufbauspiel ist im Grunde ein Geflecht aus solchen Regelkreisen.

## Ein Arbeiter als Zustandsautomat {#states}

Wie programmiert man das Verhalten eines Arbeiters? Mit einem [endlichen Automaten](https://de.wikipedia.org/wiki/Endlicher_Automat)
(*finite state machine*). Ein Arbeiter ist immer in genau einem Zustand – arbeiten, laufen, essen, schlafen, warten –
und bestimmte Bedingungen lassen ihn in einen anderen wechseln.

![Die Zustände eines Arbeiters und die Bedingungen für die Wechsel. Jede Arbeitsrunde kostet Ausdauer; wer nicht mehr kann, isst und schläft.](blog/economy/worker-states-de.svg)

Im Code ist das eine `switch`-Anweisung, die in jedem Takt für jeden Arbeiter läuft. Die meisten Zustände zählen nur
einen Zeitgeber herunter; ist er bei null, wird die nächste Entscheidung getroffen:

```js src/sim/systems/workers.js
switch (w.state) {
  case 'walk':
    if (moveAlong(sim, w, W.speed)) {               // Ziel erreicht?
      if (isAdjacent(w, target)) arrive(sim, w); else decide(sim, w);
    }
    return;
  case 'working':
    if (--w.timer > 0) return;                       // Arbeitsrunde läuft noch
    finishCycle(sim, w);                             // Ertrag gutschreiben, Ausdauer −100
    decide(sim, w);
    return;
  case 'eating':
    if (--w.timer > 0) return;
    w.stamina = Math.min(W.maxStamina, w.stamina + Math.trunc((W.eatGain * motivationFactor(w)) / 100));
    w.ate = true;
    decide(sim, w);
    return;
  …
}
```

Die eigentliche Logik steckt in `decide()` – einer Kette von Wenn-dann-Regeln mit Vorrang:

```pseudo
funktion entscheide(arbeiter):
  wenn ausdauer < 100: rasten = wahr
  wenn rasten:
    wenn noch nicht gegessen: gehe zum Bauernhof (sonst Lagerfeuer)
    sonst:                    gehe zum Wohnhaus (sonst Lagerfeuer)
  sonst wenn Veredler und Hände leer:
    wenn Rohstoff im Lager: gehe ihn holen
    sonst: warte an der Werkstatt
  sonst: gehe zur Arbeit
```

Beachte, dass Essen und Schlafen mit der **Motivation** multipliziert werden: Ein zufriedener Arbeiter erholt sich
schneller und arbeitet deshalb mehr. So wirkt eine einzige Zahl auf die ganze Wirtschaft.

## Zahlen gehören in Tabellen {#data}

Wie lange dauert eine Arbeitsrunde des Schmieds? Wie viel Stein kostet ein Wohnhaus? Solche Werte stehen nicht
verstreut im Code, sondern in **Datentabellen** unter `src/sim/data/`:

```js src/sim/data/professions.js
export const PROFESSIONS = {
  farmer:     { name: 'Bauer',         building: 'farm',       kind: 'none',     cycle: 60 },
  scholar:    { name: 'Gelehrter',     building: 'university', kind: 'research', cycle: 50 },
  miner:      { name: 'Bergmann',      building: null,         kind: 'mine',     cycle: 50, yield: 5 },
  brickmaker: { name: 'Ziegelbrenner', building: 'brickworks', kind: 'refine',   cycle: 40, res: 'clay', yield: 2 },
  smith:      { name: 'Schmied',       building: 'smithy',     kind: 'refine',   cycle: 40, res: 'iron', yield: 2 },
  …
};
```

Das Prinzip heißt [datengetriebene Programmierung](https://en.wikipedia.org/wiki/Data-driven_programming): Der Code
beschreibt, *wie* ein Beruf funktioniert (abbauen, veredeln, forschen), die Tabelle, *wie viel*. Das zahlt sich
mehrfach aus. Balance-Änderungen sind eine Zeile. Ein Agent kann sie gezielt ändern, ohne Logik anzufassen. Und das
[Kompendium](compendium/) der Website erzeugt seine Tabellen direkt aus diesen Daten – es kann also nie veraltet sein.

Jeder Wert ohne Beleg trägt im Code den Vermerk `(A)` für „Annahme“; die übrigen stammen aus der Community-Dokumentation
des Vorbilds. So lässt sich später nachvollziehen, ob eine Zahl absichtlich so ist oder geraten war.

## Zahltag, Steuern und Motivation {#payday}

Alle 1 200 Takte (120 Sekunden) rechnet `updatePayday` ab. Die Steuer hat fünf Stufen von „keine“ bis „sehr hoch“:

| Steuerstufe | Taler je Arbeiter | Motivation je Zahltag |
|---|---:|---:|
| keine | 0 | +8 |
| niedrig | 2,5 | +4 |
| normal | 5 | ±0 |
| hoch | 7,5 | −6 |
| sehr hoch | 10 | −12 |

```js src/sim/systems/payday.js
export function taxIncome(workers, taxLevel) {
  return Math.trunc((workers * BALANCE.tax.perWorker * BALANCE.tax.factorsPercent[taxLevel]) / 100);
}
```

`Math.trunc` statt Kommazahlen – auch hier bleibt die Simulation ganzzahlig. Sinkt die Motivation eines Arbeiters unter
25 %, zieht er weg; liegt der Durchschnitt unter 30 %, kommen keine neuen Siedler mehr. Zierbauten (Uhr, Windrad) und
die Segnungen der Kapelle heben die Motivation. Steuern einstellen kann man übrigens erst, wenn die Hochschule die
Technologie „Bildung“ erforscht hat – Forschung ist einfach ein weiterer Beruf, dessen Ertrag Forschungspunkte sind.

## Wie man so etwas testet {#tests}

Wirtschaft ist voller Zusammenhänge, die man beim Spielen kaum nachprüfen kann: Produziert ein Steinmetz mit Haus und
Hof wirklich mehr als einer am Lagerfeuer? Die Tests bauen genau solche Situationen auf und vergleichen:

```text
✓ a stonemason comes from the village centre as soon as the workshop is built
✓ refiners fetch raw material and make more refined goods from it
✓ with house and farm clearly more is produced than at the campfire
✓ overtime increases output but costs motivation
✓ very high tax brings double and lowers motivation
✓ with too low motivation workers leave
✓ under 30 % average no new settlers arrive
```

Weil die Simulation deterministisch ist, sind solche Vergleiche fair: Beide Läufe starten mit demselben Seed, nur ein
Gebäude ist anders.

## Was nicht klappte {#problems}

Die ersten Zahlenwerte waren eine Annäherung. Einen Tag später nahm sich eine eigene Aufgabe die Balance noch einmal
vor: Eine Analyse der Veredler (wie viel Ware pro Minute bei welcher Versorgung?) stimmte Motivation, Haus und Hof ab,
Truppen bekamen eigene Werte mit den Kräfteverhältnissen des Vorbilds, und jede Karte bekam eine Holzgarantie fürs
Umland – vorher konnte es passieren, dass ein Spieler kaum Bäume in Reichweite hatte.

## Zum Nachmachen {#tips}

- **Balance gehört in Daten, nicht in Code.** Dann kann ein Agent sie gezielt ändern, ohne Logik anzufassen.
- **Modelliere Figuren als Zustandsautomaten.** Zeichne die Zustände zuerst auf Papier – das Diagramm oben ist fast
  eins zu eins der Code.
- **Schreib zu jeder Regel die Quelle dazu** (bei uns die Community-Dokumentation des Vorbilds oder „Annahme“) – so
  lässt sich später prüfen, ob etwas absichtlich so ist.
