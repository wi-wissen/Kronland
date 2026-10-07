---
title: Die erste Welle: Entwicklermodus, Hang, Spielstände, Website
date: 2026-10-04T16:31:12+02:00
teaser: Eine CLAUDE.md für alle Sitzungen, dann ein Dutzend Aufgaben parallel. Wie man A* beim Suchen zusieht, wie ein Hang zum Bauplatz wird und wie ein Spielstand auch in einem Jahr noch ladbar bleibt.
milestone: true
---

## Worum es geht {#what}

Bis zu diesem Meilenstein hat meist eine Sitzung nach der anderen am Spiel gearbeitet. Am 4. Oktober ändert sich
das: Zwischen 10:29 und 11:15 Uhr beginnen fünf Aufgaben gleichzeitig, bis zum Nachmittag kommen weitere dazu. Jede
läuft in einer eigenen Sitzung auf einem eigenen Git-Zweig. Um 13:30 Uhr landet eine Datei namens `CLAUDE.md` im
Repository, danach werden die Ergebnisse nacheinander in `main` übernommen.

Was dabei entsteht:

- **Entwicklermodus:** Drahtgitter, Detailstufen, die A\*-Wegsuche zum Zusehen, Raster-Ansichten und eine Statistik –
  ausdrücklich auch für den Informatikunterricht gedacht.
- **Bauen am Hang:** Die Simulation ebnet den Bauplatz ein, die Bauvorschau zeigt es gelb an.
- **Spielstände:** mehrere Speicherplätze, automatisches Speichern, Export und Import als Datei.
- **Website:** Das Spiel zieht nach `play/`, daneben entstehen Startseite, Handbuch und ein Nachschlagewerk, das
  seine Tabellen direkt aus den Spieldaten liest.
- Dazu Erweiterungsinhalte, Tooltips per langem Druck am Handy, ein Nahzoom, ein Symbol-Atlas aus einer Bild-KI und
  eine Kamera, die sich wie ein Kartenprogramm bedienen lässt.

Dieser Artikel greift drei Themen heraus, an denen man viel Informatik sehen kann: die sichtbare Wegsuche, das
Einebnen eines Hangs und das Dateiformat der Spielstände. Am Anfang steht aber die Frage, wie man überhaupt viele
Aufgaben gleichzeitig bearbeiten lässt.

## Viele Sitzungen, ein Regelwerk {#rules}

Eine KI-Sitzung beginnt ohne Erinnerung an frühere Sitzungen. Sie sieht nur den Code und das, was man ihr sagt.
Arbeiten fünf Sitzungen gleichzeitig, muss jede selbst herausfinden, dass die Simulation nur Ganzzahlen benutzen
darf, dass jeder Text zweisprachig sein muss und dass das Spiel auch am Handy funktionieren soll. Das kostet Zeit,
und jede zieht womöglich andere Schlüsse.

Die Lösung ist schlicht: eine Datei im Wurzelverzeichnis, die jede Sitzung zu Beginn liest. `CLAUDE.md` ist kurz und
enthält nur, was wirklich für alle gilt – den Technik-Stack, die wichtigsten Befehle und eine Liste fester Regeln.
Ein Ausschnitt:

```text CLAUDE.md
- Simulation (src/sim) ist deterministisch: nur Ganzzahlen (Milli-Kacheln, isqrt),
  seeded RNG, kein Math.random, kein Date, fester 100-ms-Tick. …
- Alle Texte zweisprachig über src/i18n (de.js, en.js, t()) …
- Handy mitdenken: Touch, kein Hover, kleine Bildschirme.
- Neue Logik bekommt Vitest-Tests, sichtbare Funktionen eine Playwright-Spec.
```

Warum die Simulation so streng sein muss, erklärt [Artikel 1](blog/simulation-core/). Hier zählt etwas anderes: Mit
dieser Datei werden aus einem langen Gespräch viele kurze, unabhängige Aufträge. Jede Aufgabe bekommt einen Zweig,
und bevor sie in `main` übernommen wird, holt sie sich den aktuellen Stand von `main` und lässt alle Tests laufen. So
fällt ein Widerspruch zwischen zwei Aufgaben beim Zusammenführen auf und nicht erst beim Spielen.

![Ab dem 4. Oktober arbeiten mehrere Sitzungen parallel, jede auf einem eigenen Zweig. Die Ergebnisse kommen nacheinander in main.](blog/first-wave/branches-de.svg)

Das Prinzip kennt man aus jedem Softwareprojekt mit mehreren Menschen. Wer sich für die Werkzeuge interessiert,
findet unter [Git](https://de.wikipedia.org/wiki/Git) und [Versionsverwaltung](https://de.wikipedia.org/wiki/Versionsverwaltung)
den Einstieg.

## Der Wegsuche zusehen {#astar}

Wie Figuren ihren Weg finden, erklärt [Artikel 1](blog/simulation-core/): Die Karte ist ein Raster aus Kacheln, und der
[A\*-Algorithmus](https://de.wikipedia.org/wiki/A%2A-Algorithmus) sucht darauf den kürzesten Weg. Kurz zur
Erinnerung: A\* bewertet jedes Feld mit

```pseudo
f = g + h
g = bisherige Kosten vom Start (gerade Schritte 10, schräge 14)
h = geschätzte Restkosten bis zum Ziel (Oktil-Abstand)
```

und untersucht immer das Feld mit dem kleinsten `f` als Nächstes. Die *offene Liste* enthält Felder, die schon
entdeckt, aber noch nicht untersucht sind, die *geschlossene Liste* die bereits untersuchten.

Im Entwicklermodus kann man genau dabei zusehen. Man wählt eine Figur, tippt ein Ziel an, und das Spiel spielt die
Suche Schritt für Schritt ab: Türkis ist die offene Liste, Orange die geschlossene, Gelb der gefundene Weg.

![Mitten in der Suche: Die Figur steht an der Burg, das Ziel (Magenta) liegt hinter einem Felsrücken. Orange sind die schon untersuchten Felder, Türkis die Grenze der Suche. Das Panel zählt mit: 34 offen, 297 geschlossen.](blog/first-wave/astar-mid.webp)

![Am Ende: Der gelbe Weg führt um den Fels herum. Für 57 Schritte Weg hat A* 706 Felder untersucht – geradeaus auf das Ziel zu geht es eben nicht.](blog/first-wave/astar-end.webp)

### Messen, ohne zu stören

Spannend ist, wie das gebaut ist. Die Simulation darf von der Anzeige nichts merken – sonst wären zwei Rechner mit
und ohne Entwicklermodus nicht mehr im gleichen Zustand. Deshalb rechnet der Entwicklermodus die Suche **ein zweites
Mal** mit genau derselben Funktion `findPath` und gibt ihr einen *Beobachter* mit: eine Funktion, die bei jedem
Schritt aufgerufen wird und mitschreibt.

```js src/dev/astar.js
export function recordSearch(map, sx, sy, goals, maxNodes = 20000) {
  …
  const observer = (kind, i, gv, hv, p) => {
    type[n] = kind === 'open' ? EV_OPEN : kind === 'close' ? EV_CLOSE : EV_GOAL;
    tile[n] = i; g[n] = gv; h[n] = hv; parent[n] = p;
    n++;
  };
  const path = findPath(map, sx, sy, goals, maxNodes, observer);
  …
}
```

Im normalen Spiel ist der Beobachter `null`. Die Wegsuche prüft dann an jeder Stelle nur `if (observer)` – das
kostet praktisch nichts. Ein Vitest-Test stellt sicher, dass die Suche mit und ohne Beobachter dieselben Wege
liefert und der Zustands-Hash der Simulation unverändert bleibt.

Die Aufzeichnung ist eine Liste von Ereignissen in
[typisierten Arrays](https://developer.mozilla.org/de/docs/Web/JavaScript/Guide/Typed_arrays) (`Uint8Array`,
`Int32Array`). Zum Abspielen baut `SearchPlayback` den Zustand jedes Feldes bis zu einem beliebigen Schritt auf:
vorwärts Schritt für Schritt, rückwärts einfach neu von vorn. Statt den Zustand zu jedem Zeitpunkt zu speichern,
speichert man also die Ereignisse und rechnet den Zustand bei Bedarf nach. Dieses Muster heißt
Event Sourcing.

### Ideen für den Unterricht

Die Dokumentation des Entwicklermodus (`docs/ENTWICKLERMODUS.md`) enthält Unterrichtsideen. Zwei davon:

- **Heuristik verstehen:** Ein Ziel auf freier Wiese und eins hinter einem Hindernis wählen. Warum ist die
  geschlossene Liste im ersten Fall schmal und im zweiten breit? Was würde passieren, wenn `h` immer 0 wäre? (Dann
  wird aus A\* der [Dijkstra-Algorithmus](https://de.wikipedia.org/wiki/Dijkstra-Algorithmus), der in alle Richtungen
  gleich weit sucht.)
- **Erreichbarkeit vorab prüfen:** „Gebiete einfärben“ zeigt zusammenhängende begehbare Flächen. Liegt das Ziel auf
  einer Insel, sucht das Spiel gar nicht erst. Wie findet man solche Gebiete? (Mit einer
  [Breitensuche](https://de.wikipedia.org/wiki/Breitensuche), die alle erreichbaren Felder einfärbt; mehr dazu in [Artikel 8](blog/qa-fog/).)

## Bauen am Hang {#slope}

Bisher durfte man nur auf ebenem Boden bauen. Das Vorbild erlaubt Gebäude auch am Hang und gräbt den Bauplatz
dafür flach. Die Regel ist einfach: Unter einem Gebäude dürfen höchstens 4 m Höhenunterschied liegen
(`BALANCE.maxSlope`). Ist das erfüllt, ebnet die Simulation beim Setzen der Baustelle den Boden ein.

Die Höhen liegen als Ganzzahlen in Zentimetern in einem Array, eine Zahl je Kachel. Das Einebnen geschieht in zwei
Schritten:

1. **Zielhöhe** ist der gerundete Mittelwert aller Kacheln unter dem Gebäude. Jede dieser Kacheln wird auf die
   Zielhöhe gesetzt.
2. **Übergang:** Ein Ring von einer Kachel Breite rundherum bewegt sich mit. Kacheln an einer Kante gehen die halbe
   Strecke zur Zielhöhe, Kacheln an einer Ecke ein Viertel. So entsteht keine senkrechte Stufe.

![Schnitt durch einen Hang. Blau der Boden vorher, die Säulen zeigen die Höhen nachher: Der Bauplatz liegt auf dem Mittelwert, die Randkacheln gehen die halbe Strecke mit.](blog/first-wave/slope-de.svg)

Der Code dazu ist kurz:

```js src/sim/systems/terrain.js
export function padHeight(map, x, y, w, h) {
  let sum = 0, n = 0;
  for (…) { sum += map.heights[map.idx(i, j)]; n++; }
  return Math.floor((2 * sum + n) / (2 * n));   // gerundet, nur Ganzzahlen
}

export function levelSite(sim, x, y, w, h) {
  const target = padHeight(map, x, y, w, h);
  // 1. Bauplatz auf die Zielhöhe
  for (…) H[k] = target;
  // 2. Ring außen herum: Kante halb, Ecke ein Viertel
  for (…) {
    if (F[k] & KEEP) continue;              // Wasser, Klippe, Nachbargebäude bleiben
    const d = target - H[k];
    H[k] += corner ? Math.trunc(d / 4) : Math.trunc(d / 2);
  }
  sim.events.push({ type: 'terrainChanged', x: x - 1, y: y - 1, w: w + 2, h: h + 2 });
}
```

Zwei Dinge sind hier typisch für das ganze Projekt. Erstens: Der Mittelwert wird mit
`Math.floor((2 * sum + n) / (2 * n))` gerundet. Das ist ein Trick, um ohne Kommazahlen kaufmännisch zu runden, denn
die Simulation kennt nur Ganzzahlen. Zweitens: Die Simulation ändert nur ihre Zahlen und meldet ein Ereignis
`terrainChanged` mit dem betroffenen Rechteck. Die Darstellung hört darauf und baut nur diesen Teil des
Geländenetzes neu. Simulation und Grafik bleiben getrennt.

Der Ring außen herum lässt Wasser, Klippen und Nachbargebäude in Ruhe (`F[k] & KEEP` prüft die
[Bitflags](https://de.wikipedia.org/wiki/Bitfeld) der Kachel). Sonst würde ein neues Haus das Fundament seines
Nachbarn verschieben.

## Spielstände, die altern dürfen {#saves}

Speichern klingt einfach: Zustand in Text verwandeln, ablegen, fertig. Schwierig wird es mit der Zeit. Das Spiel
ändert sich ständig, neue Gebäude kommen hinzu, Felder werden umbenannt. Ein Spielstand von heute muss auch mit dem
Spiel in einem Jahr noch ladbar sein.

### Der Umschlag

Ein Spielstand besteht deshalb aus zwei Teilen: einem *Umschlag* mit Formatangaben und Metadaten und dem eigentlichen
Simulationszustand.

```json
{
  "format": "kronland-save",
  "formatVersion": 1,
  "gameVersion": "1.0.0",
  "meta": { "name": "Mission 2 – 0:42:10", "savedAt": "…", "tick": 25300,
            "mode": "mission", "mission": "c2", "seed": 42, "players": 2, "fog": true },
  "state": { … }
}
```

Die Liste der Speicherplätze liest nur `meta` – sie muss nicht den ganzen Zustand verstehen. `state` dagegen ist
genau das, was `saveGame()` aus der Simulation liefert.

### Migrationen

Ändert sich das Format, steigt `formatVersion`. Für jeden Schritt gibt es eine kleine Funktion, die ein Dokument
von Version *v* auf *v + 1* hebt. Beim Laden werden sie der Reihe nach angewendet:

```js src/save/format.js
export const MIGRATIONS = {
  // Version 0: der frühere „nackte“ Spielstand ohne Umschlag
  0: (state) => ({ format: FORMAT, formatVersion: 1, gameVersion: 'unknown',
                   meta: { name: '', savedAt: new Date(0).toISOString(), ...describeState(state) },
                   state }),
};
```

```pseudo
// beim Laden, als Pseudocode:
v = detectVersion(doc)
solange v < FORMAT_VERSION:
    doc = MIGRATIONS[v](doc)
    v = v + 1
```

Jede Migration muss nur den Unterschied zwischen zwei benachbarten Versionen kennen; ein uralter Spielstand wandert
einfach durch alle Stufen. Datenbanken machen es genauso, dort heißt das
[Schemamigration](https://en.wikipedia.org/wiki/Schema_migration).

### Wo die Daten liegen

Im Browser gibt es zwei Speicher. `localStorage` ist einfach, aber klein (meist etwa 5 MB) und *synchron*: Während
geschrieben wird, steht die Seite. [IndexedDB](https://de.wikipedia.org/wiki/Indexed_Database_API) ist eine kleine
Datenbank im Browser mit viel mehr Platz, und sie arbeitet *asynchron*. Das Spiel versucht zuerst IndexedDB, dann
`localStorage`. Fehlt beides (manche private Fenster), hält es die Spielstände wenigstens im Arbeitsspeicher und sagt
das auch. Abgelegt wird alles komprimiert.

## Was nicht klappte {#problems}

- **Spielstände** brauchten sechs Nachbesserungen. Eine Frist für IndexedDB schlug zu, wenn das Spiel den
  Hauptfaden gerade voll auslastete. Änderungen in mehreren offenen Tabs mussten *atomar* werden – Lesen, Ändern und
  Schreiben in einer einzigen [Transaktion](https://de.wikipedia.org/wiki/Transaktion_%28Informatik%29) –, sonst
  überschreibt ein Tab die Änderung des anderen. Und das Ziehen einer Datei auf die Seite öffnete sie versehentlich im
  Browser, statt sie zu importieren.
- **Symbol-Atlas:** Gemini lieferte einen schönen Bogen, aber im falschen Raster (14 × 7), mit erfundenen und
  doppelten Symbolen und dem Wort „TAX“ trotz Verbot. Automatisch zuordnen ließ sich das nicht. Das GPT-Bildmodell
  hielt das Raster ein.
- **E2E unter Software-Grafik:** Die Playwright-Tests laufen ohne Grafikkarte, jedes Bild wird auf dem Prozessor
  berechnet. Speichern/Laden, Beschriftungen und Gruppen brauchten deutlich längere Zeitlimits.

## Zum Nachmachen {#tips}

- Schreib die gemeinsamen Regeln auf, bevor du parallelisierst – sonst erklärt jede Sitzung sie sich neu.
- Kleine Aufgaben mit klarem, prüfbarem Ergebnis eignen sich am besten für parallele Arbeit.
- Willst du einem Algorithmus zusehen, ruf ihn ein zweites Mal mit einem Beobachter auf, statt ihn umzubauen.
- Gib jedem Dateiformat von Anfang an eine Versionsnummer. Migrationen sind billig, wenn man sie früh einplant.
- Plane relative Pfade (`siteUrl()`) früh, wenn neben dem Spiel eine Website entstehen soll.
