---
title: QA-Runden, Balance und Nebel des Krieges
date: 2026-10-04T09:51:07+02:00
teaser: Eine unabhängige QA-Sitzung findet 26 Befunde, Fuzz-Tests werfen Unsinn auf die Simulation, ein Bot gewinnt die Kampagne auf vier Karten, und der Nebel des Krieges kommt – mit einer KI, die nicht schummelt.
milestone: true
---

## Was entstand {#what}

In der Nacht zum 4. Oktober prüft eine eigene QA-Sitzung das Spiel – QA steht für *Quality Assurance*,
[Qualitätssicherung](https://de.wikipedia.org/wiki/Qualit%C3%A4tssicherung). Sie spielt im Browser auf Desktop und Handy
(hoch und quer, Deutsch und Englisch), schreibt Fuzz- und Dauertests und sieht die Risikobereiche im Code durch.
Parallel spielt ein Missions-Bot jede Kampagnenmission, bis er alle auf vier Karten im Zeitlimit gewinnt. Am Morgen
folgt der Nebel des Krieges: Sicht je Team, erkundete Gebiete, zuletzt gesehene Gebäude – und eine KI, die nur kennt,
was sie gesehen hat. Dazu kommen 57 neue Vitest-Tests.

## Prüfen, wer nicht gebaut hat {#independent}

Wer Code geschrieben hat, testet ihn mit den Annahmen, mit denen er ihn geschrieben hat – und übersieht dieselben
Fälle zweimal. Deshalb bekam eine *neue* Sitzung, die keine Zeile des Spiels geschrieben hatte, einen ausdrücklichen
Auftrag: Fehler finden, nicht bestätigen, dass alles geht. Jeder Befund kommt mit Schwere, Nachstellweg und Behebung in
`docs/QA-BERICHT.md`. Am Ende stehen dort 26 Befunde, alle behoben. Eine Auswahl:

| Schwere | Befund | Behebung |
|---|---|---|
| Hoch | Jeder Spielstart ließ den alten Renderer samt WebGL-Kontext im Speicher: 50 → 96 MB nach fünf Starts. | `Renderer.dispose()` gibt Szene, Zwischenspeicher, Gelände und Wasser frei – danach 50 → 52 MB. |
| Hoch | Ruckler bis über eine Sekunde pro Takt bei Computergegnern. | Gebietsnummern (siehe unten) – 60 Minuten KI-Dauerlauf in 34 s statt rund 10 min. |
| Mittel | Ein Befehl mit `building: 'toString'` brachte die Simulation zum Absturz. | Tabellen werden nur noch mit eigenen Schlüsseln nachgeschlagen (`Object.hasOwn`). |
| Mittel | Türme ausgeschiedener Spieler schossen weiter und waren unangreifbar. | Die Prüfung „ist Feind?“ gilt jetzt in beide Richtungen. |
| Niedrig | Zustands-Hash ohne Wetter, Frost und Truppenstufen. | Felder in den Hash aufgenommen – ein Auseinanderlaufen fiele sonst erst spät auf. |

Ein [Speicherleck](https://de.wikipedia.org/wiki/Speicherleck) in JavaScript? Ja, das gibt es, obwohl der Browser
Speicher automatisch aufräumt: Die [Speicherbereinigung](https://de.wikipedia.org/wiki/Garbage_Collection) entfernt
nur Objekte, auf die *nichts mehr verweist*. Hält irgendein Zwischenspeicher oder Ereignis-Zuhörer noch einen Verweis
auf den alten Renderer, bleibt alles daran hängen – inklusive Grafikspeicher. Gefunden wurde die Kette mit einem
Heap-Schnappschuss der Entwicklerwerkzeuge.

## Fuzzing: Unsinn mit System {#fuzz}

[Fuzzing](https://de.wikipedia.org/wiki/Fuzzing) heißt: ein Programm mit zufälligen, oft absurden Eingaben bombardieren
und schauen, ob es abstürzt oder in einen unmöglichen Zustand gerät. Für Kronland ist das besonders wichtig, denn im
geplanten Mehrspielermodus kommen Befehle von fremden Rechnern – und *ein* böswilliger Befehl, der die Simulation zum
Absturz bringt, würde alle Spieler treffen.

Der Fuzz-Test erzeugt mit einem Zufallsgenerator mit Seed lange Befehlsfolgen von mehreren Spielern. Die meisten sind
plausibel (bauen, kaufen, angreifen), aber immer wieder ist Unsinn dabei:

```js tests/sim/fuzzHelpers.js
const GARBAGE = ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'nope', null, 42, …];
…
{ type: 'buySerf', player: p, count: r.pick([-3, 0, 1e9, NaN, 2.5]) },
{ type: 'setTax', player: p, level: r.pick([-1, 5, 2.5, 'x', NaN]) },
```

Alle 250 Takte prüft der Test **Invarianten** – Aussagen, die *immer* wahr sein müssen, egal was passiert ist:

```js tests/sim/fuzzHelpers.js
for (const r of RESOURCES) {
  const v = p[acc][r];
  if (!Number.isInteger(v) || v < 0) bad.push(`P${p.id} ${acc}.${r}=${v}`);   // Vorräte: ganzzahlig, nie negativ
}
…
if (e.px < 0 || e.py < 0 || e.px >= W || e.py >= H) bad.push(`${tag} outside …`); // niemand außerhalb der Karte
if (!wp || !wp.workers.includes(e.id)) bad.push(`${tag} workplace …`);            // Verweise in beide Richtungen
```

Der Clou kommt aus dem Determinismus des [ersten Artikels](blog/simulation-core/#determinism): Der Test zeichnet alle
Befehle auf. Findet er einen Fehler, lässt er sich mit derselben Befehlsliste beliebig oft *bitgenau* nachstellen. Und
er prüft gleich noch das Speichern: Lauf bis zur Hälfte, speichern, über JSON laden, mit denselben Befehlen
weiterlaufen – der Endzustand muss exakt derselbe sein wie ohne Unterbrechung.

```js tests/sim/fuzz.test.js
const b = fuzzRun({ ...c, replay: a.log });
expect(b.hashes).toEqual(a.hashes);                         // Wiederholung = identisch
const first = fuzzRun({ ...c, ticks: half, replay: a.log });
const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(first.sim))));
const rest = fuzzRun({ ...c, sim: loaded, from: half, replay: a.log });
expect(loaded.hash()).toBe(a.sim.hash());                   // speichern + laden = ohne Unterbrechung
```

So fand der Fuzz-Test im Takt 1 259 den Absturz durch `building: 'toString'`: Die Simulation schlug
`BUILDINGS['toString']` nach – und fand dort die eingebaute Methode jedes JavaScript-Objekts statt eines Gebäudes.

## Gebiete: erst prüfen, dann suchen {#regions}

Der teuerste Befund betraf die Wegsuche aus dem [ersten Artikel](blog/simulation-core/#pathfinding). A\* findet
schnell einen Weg, *wenn es einen gibt*. Gibt es keinen – das Ziel liegt auf einer Insel oder jenseits des Flusses –,
muss er erst die gesamte erreichbare Fläche absuchen, bevor er aufgeben kann. Und genau das passierte ständig, weil die
Computergegner Leibeigene zu unerreichbaren Bäumen schickten: bis zu 1 724 vergebliche Suchen in 150 Sekunden.

Die Lösung: Die Karte nummeriert vorab ihre **Gebiete** – zusammenhängende begehbare Flächen, in der Graphentheorie
[Zusammenhangskomponenten](https://de.wikipedia.org/wiki/Zusammenhang_%28Graphentheorie%29). Ein Floodfill startet an
jeder noch unnummerierten begehbaren Kachel und vergibt allen erreichbaren Kacheln dieselbe Nummer:

![Gebiete per Floodfill: Wasser trennt die Karte in Gebiet 1 und 2, ein umschlossener Teich enthält Gebiet 3. Liegen Start und Ziel in verschiedenen Gebieten, ist die Antwort sofort klar.](blog/qa-fog/regions-de.svg)

```js src/sim/map.js
computeRegions(frozen) {
  const reg = new Int32Array(n), queue = new Int32Array(n);
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (reg[s] || !ok(s)) continue;               // schon nummeriert oder nicht begehbar
    id++;
    let head = 0, tail = 0;
    queue[tail++] = s; reg[s] = id;
    while (head < tail) {                          // Breitensuche
      const k = queue[head++], x = k % W, y = (k / W) | 0;
      if (x > 0     && !reg[k - 1] && ok(k - 1)) { reg[k - 1] = id; queue[tail++] = k - 1; }
      if (x < W - 1 && !reg[k + 1] && ok(k + 1)) { reg[k + 1] = id; queue[tail++] = k + 1; }
      if (y > 0     && !reg[k - W] && ok(k - W)) { reg[k - W] = id; queue[tail++] = k - W; }
      if (y < H - 1 && !reg[k + W] && ok(k + W)) { reg[k + W] = id; queue[tail++] = k + W; }
    }
  }
  return reg;
}
```

Danach ist „erreichbar?“ eine einzige Abfrage: `regionAt(start) === regionAt(ziel)`. Die Nummerierung wird nur neu
berechnet, wenn sich etwas ändert (ein Baum fällt, ein Haus wird gebaut) – dafür zählt die Karte bei jeder Änderung
einen Versionszähler hoch, und erst die nächste Abfrage rechnet nach (*lazy evaluation*). Im Winter, wenn das Eis
trägt, gibt es eine zweite Nummerierung.

Ergebnis: Der 60-Minuten-Dauerlauf mit vier Computergegnern auf der größten Karte dauerte danach 34 Sekunden statt rund
zehn Minuten, der langsamste Takt 120 ms statt 1,6 s. Und die Computergegner planen seitdem nur noch erreichbare Ziele.

## Ein Bot spielt die Kampagne {#bot}

Ist eine Mission zu schwer oder zu leicht? Das lässt sich messen. Der Missions-Bot ist ein Spieler-Programm, das – wie
die KI – nur Befehle gibt, die auch die Oberfläche geben kann. Er hat für jede Mission eine Strategie (Bauplan,
Forschung, Rekrutierplan) und spielt sie ohne Bildschirm durch. `scripts/campaign-matrix.js` lässt ihn alle Missionen
auf vier Karten spielen und schreibt eine Tabelle:

| Mission | Zeitlimit | Siege | Dauer (min) | Passiver Bot |
|---|---:|---:|---:|---|
| c1 | 20 | 4/4 | 3,2–4,0 | – |
| c2 | 30 | 4/4 | 9,6–9,8 | verliert (Min. 6–8) |
| c3 | 40 | 4/4 | 16,3–19,7 | verliert bzw. kommt nicht weiter |
| c4 | 40 | 4/4 | 3,4–3,9 | verliert beim Tauwetter |
| c5 | 60 | 4/4 | 16,5–23,1 | verliert (Min. 19–20) |

Die letzte Spalte ist eine **Gegenprobe**: Ein „passiver“ Bot baut nur Wirtschaft und kämpft nicht. Er *muss*
verlieren – sonst wäre die Mission keine Herausforderung. Vor der Abstimmung gewann der Bot Mission 5 nur auf einer oder
zwei von vier Karten; danach auf allen.

## Nebel des Krieges {#fog}

Bis hierhin sah jeder Spieler die ganze Karte – auch die gegnerische Burg und jede feindliche Truppe. Der
[Nebel des Krieges](https://de.wikipedia.org/wiki/Nebel_des_Krieges) ändert das. Jede Kachel ist für jedes Team in einem
von drei Zuständen:

- **unerkundet** – schwarz, man weiß nichts;
- **erkundet** – das Gelände ist bekannt, feindliche Gebäude erscheinen so, wie man sie *zuletzt gesehen* hat;
- **sichtbar** – jetzt gerade im Blick einer eigenen Figur oder eines Gebäudes.

![Der Start mit Nebel: Nur das Umland der Burg ist erkundet, der Rest der Karte (und die Minikarte unten links) ist schwarz.](blog/qa-fog/fog.webp)

Der Nebel gehört zur **Simulation**, nicht zur Grafik – denn er entscheidet, was ein Spieler (und die KI) wissen darf.
Alle fünf Takte werden die Sichtkreise aller Figuren und Gebäude neu „gestempelt“. Damit das schnell geht, sind die
Kreise vorab als Zeilenbreiten gespeichert, und jede Zeile ist ein einziger `fill()`-Aufruf auf einem Byte-Array:

```js src/sim/systems/vision.js
function stamp(v, vis, exp, cx, cy, r) {
  const s = spans(r);                                // halbe Breite je Zeile, vorab berechnet
  for (let y = Math.max(0, cy - r); y <= Math.min(v.H - 1, cy + r); y++) {
    const hw = s[y - cy + r];
    const x0 = Math.max(0, cx - hw), x1 = Math.min(v.W - 1, cx + hw);
    const k = y * v.W;
    if (vis) vis.fill(1, k + x0, k + x1 + 1);        // sichtbar
    if (exp) exp.fill(1, k + x0, k + x1 + 1);        // erkundet (wird nie gelöscht)
  }
}
```

Die Sichtweiten stehen – natürlich – in einer Datentabelle: Burg und Türme sehen weit, Arbeiter kaum über ihren Hof
hinaus, Regen und Schnee verkürzen die Sicht.

Und die KI? Sie bekommt **dieselben Informationen** wie ein Mensch. Feindliche Truppen kennt sie nur, wenn ihr Team
sie sieht, feindliche Gebäude nur im zuletzt gesehenen Zustand. Wie im Vorbild kennt sie anfangs nur die
Startpositionen. Fairness ist hier also keine Eigenschaft der KI, sondern eine Regel der Simulation: Die KI *kann* gar
nicht mehr wissen. Einzige Ausnahme: Die schwere Stufe bemerkt Feinde nahe der eigenen Burg auch im Nebel.

## Was nicht klappte {#problems}

Neben den Befunden oben gab es einen, der zeigt, wie tückisch Wegsuche sein kann: **Truppen schnitten Wasserecken** und
blieben stecken. Die Wegsuche verbot schräge Schritte an Ecken (siehe [Simulationskern](blog/simulation-core/#pathfinding)),
aber die Bewegung zwischen zwei Wegpunkten lief in mehreren Teilschritten – und ein Teilschritt konnte doch über die
Ecke rutschen. Seitdem geht jeder Teilschritt höchstens in eine Nachbarkachel, diagonal nur, wenn beide Nachbarn
begehbar sind: dieselbe Regel wie bei der Suche.

Und der Nebel stellte eine unbequeme Frage: Die KI hatte bis dahin mit perfekter Information gespielt. Wie soll sie
angreifen, wenn sie den Gegner nicht sieht? Die Antwort folgt dem Vorbild: Sie marschiert zu den bekannten
Startpositionen und greift an, was sie dort sieht.

## Zum Nachmachen {#tips}

- **Lass eine Sitzung prüfen, die den Code nicht geschrieben hat** – mit dem ausdrücklichen Auftrag, Fehler zu finden.
- **Schreib Invarianten auf** („Vorräte nie negativ“, „niemand außerhalb der Karte“) und prüf sie in Fuzz- und
  Dauertests. Sie finden Fehler, an die niemand gedacht hat.
- **Ein Bot, der die Kampagne gewinnen muss, ist ein Balance-Test, der nie müde wird** – mit Gegenprobe.
- **Fairness der KI ist eine Regel der Simulation, nicht der KI:** Sie bekommt nur, was ihr Team sieht.
