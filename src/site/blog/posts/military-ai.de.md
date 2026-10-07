---
title: Militär und Computergegner
date: 2026-10-03T12:35:21+02:00
teaser: Kampf, Türme, Helden und Wetter – und ein Computergegner, der über dieselben Befehle spielt wie der Mensch. Wie „denkt“ so eine KI, und wie spielt man tausend Partien ohne Bildschirm?
milestone: true
---

## Was entstand {#what}

Zwei Schritte in vier Minuten: zuerst Militär – Hauptleute mit Soldaten, Türme, Helden mit Fähigkeiten, Miliz, Wetter,
Sieg und Niederlage –, dann ein Computergegner, der aufbaut, forscht, ein Heer aufstellt, angreift und sich verteidigt.
Seitdem hat Kronland Gegner, und mit ihnen das wichtigste Werkzeug für Dauertests: Computer gegen Computer.

![Nach knapp 30 Minuten Spielzeit: Das blaue Heer greift die rote Siedlung an, rote Truppen verteidigen. Beide Seiten werden hier von der KI gespielt; das Bild stammt aus dem Stand dieses Meilensteins.](blog/military-ai/battle.webp)

## Kämpfen mit ganzen Zahlen {#combat}

Kampf ist in der Simulation keine Animation, sondern Rechnung. Jede Einheit hat Lebenspunkte, Angriff, Rüstung, eine
Angriffsart (Stich, Schlag, Schuss, Belagerung …) und eine Rüstungsart (keine, gepolstert, Leder, Eisen, befestigt).
Wie gut eine Angriffsart gegen eine Rüstungsart wirkt, steht in einer Tabelle in Prozent – das ergibt das bekannte
Schere-Stein-Papier der Strategiespiele: Speere gegen Reiter, Bögen gegen ungepanzerte Truppen, Kanonen gegen Mauern.

```js src/sim/data/combat.js
// Schaden = Angriff × Faktor(Angriffsart, Rüstungsart) − Rüstung + Zufall 0…2
export function computeDamage(attack, attackType, armorType, armor, bonus = 0) {
  const f = DAMAGE_FACTORS[attackType]?.[armorType] ?? 100;   // Prozent
  return Math.max(1, Math.trunc((attack * f) / 100) - armor + bonus);
}
```

Der Zufallsanteil `bonus` kommt – natürlich – aus dem Generator mit Seed (`sim.rng.int(3)`), nicht aus `Math.random`.

Ein Problem stellt sich bei jedem Kampfsystem: Wer ist der nächste Gegner? Jede Einheit mit jeder anderen zu
vergleichen, kostet bei 500 Einheiten 250 000 Vergleiche – in *jedem* Takt. Die Lösung ist ein grobes Gitter über der
Karte (*spatial hashing*): Zu Beginn jedes Takts wird jede Einheit in ihre Gitterzelle einsortiert, und die Suche
schaut nur in die Zellen im Umkreis.

```js src/sim/systems/military.js
for (const e of sim.entities.values()) {
  const p = posOf(e);
  add(Math.floor(p.x / UNIT / C), Math.floor(p.y / UNIT / C), e);   // Zelle (cx, cy)
}
…
for (let cy = …; cy <= …; cy++) for (let cx = …; cx <= …; cx++) {
  for (const t of sim.grid.get(cy * 4096 + cx) ?? []) { /* nur Nachbarn prüfen */ }
}
```

Das ist dieselbe Idee wie bei einer [Hashtabelle](https://de.wikipedia.org/wiki/Hashtabelle): Statt alles zu
durchsuchen, springt man gleich in den richtigen „Eimer“.

## Wetter als Spielregel {#weather}

Das Wetter folgt einem festen Zyklus: Sommer, Regen, Sommer, Winter. Es ist keine Dekoration, sondern ändert Regeln:
Bei Regen treffen Fernkämpfer schlechter, im Winter sind alle langsamer – und Flüsse und Seen frieren zu. Dann ist
Wasser plötzlich begehbar, und ein Angriff kann über das Eis kommen. Für die Wegsuche bedeutet das: Die Karte hat
zwei Zustände, und eine Figur auf dem Eis bei Tauwetter hat ein ernstes Problem.

## Wie ein Computergegner denkt {#ai}

Die KI in `src/ai/AiPlayer.js` ist kein neuronales Netz und lernt nichts. Sie ist ein **regelbasiertes System** – eine
Liste von Prioritäten und Zuständen, die ein Mensch aufgeschrieben hat. Das ist bei Strategiespielen die Regel, weil es
vorhersagbar, schnell und gut einstellbar ist.

![Die Denkschleife des Computergegners (links) und die drei Zustände seines Heers (rechts).](blog/military-ai/ai-de.svg)

Alle paar Takte – auf „Schwer“ alle 12, auf „Leicht“ alle 50 – läuft die Denkschleife:

```js src/ai/AiPlayer.js
update() {
  if ((sim.tick + this.offset) % this.cfg.think !== 0) return;  // nur alle n Takte
  this.cmds = [];
  this.scan();       // Lage erfassen: eigene Gebäude, Leibeigene, Truppen, Feinde nahe der Burg
  this.economy();    // Leibeigene kaufen, forschen, Steuern, bauen, ausbauen, Arbeit verteilen
  this.military();   // rekrutieren, verbessern, auffüllen, Heer führen, Helden
  for (const c of this.cmds) sim.command({ ...c, player: this.player });
}
```

Die letzte Zeile ist die wichtigste: Am Ende kommen **nur Befehle** heraus – dieselben, die auch die Oberfläche
schickt. Die KI kann keine Gebäude herbeizaubern und keine Rohstoffe erfinden.

### Ein Bauplan mit Vorrang

Was die KI baut, steht in einer Wunschliste, die von oben nach unten abgearbeitet wird:

```js src/ai/AiPlayer.js
const BUILD_PLAN = [
  ['residence', 1], ['farm', 1], ['university', 1], ['clayMine', 1], ['stoneMine', 1],
  ['residence', 2], ['farm', 2], ['sawmill', 1], ['ironMine', 1], ['brickworks', 1],
  ['barracks', 1], …
];
```

`['residence', 2]` heißt: „Wenn es noch keine zwei Wohnhäuser gibt, baue eins.“ Vor der Liste kommen dringende Fälle:
Fehlen Betten oder Essplätze für die Arbeiter, wird zuerst ein Wohnhaus oder Hof gebaut; wird die Bevölkerungsgrenze
knapp, ein neues Dorfzentrum. Militärgebäude stellt die KI in Richtung des Gegners, Wohnhäuser rund um die Burg.

### Das Heer als Zustandsautomat

Das Heer kennt drei Zustände – **sammeln**, **angreifen**, **verteidigen** –, und die Übergänge sind einfache
Bedingungen:

```pseudo
wenn Feinde nahe der eigenen Burg:          # Verteidigung hat immer Vorrang
  alle Truppen und Helden: Angriffsmarsch zum Feind
  wenn Feind deutlich stärker: Leibeigene bewaffnen (Miliz)
  zustand = verteidigen
sonst wenn zustand == sammeln:
  Truppen zum Sammelpunkt (8 Kacheln Richtung Gegner)
  wenn genug Truppen und Mindestzeit vorbei: zustand = angreifen
sonst wenn zustand == angreifen:
  wenn Stärke < 35 % der Stärke beim Aufbruch: Rückzug, zustand = sammeln
  untätige Truppen wieder antreiben
```

Die Schwierigkeitsstufen sind nichts anderes als andere Zahlen in derselben Logik:

```js src/ai/AiPlayer.js
export const DIFFICULTY = {
  easy:   { think: 50, serfs: 14, attackSize: 3, firstAttack: 21000, maxSites: 2, bonusGold: 0,   … },
  normal: { think: 25, serfs: 22, attackSize: 5, firstAttack: 14400, maxSites: 3, bonusGold: 0,   … },
  hard:   { think: 12, serfs: 28, attackSize: 6, firstAttack: 9000,  maxSites: 4, bonusGold: 250, … },
};
```

„Schwer“ denkt öfter nach, hat mehr Leibeigene, greift früher und mit mehr Truppen an (Takt 9 000 = 15 Minuten) und
bekommt – wie im Vorbild – regelmäßig etwas Gold dazu. Wie sich die Gegner aus Spielersicht verhalten, beschreibt das
[Kompendium](compendium/).

Auch die KI muss deterministisch sein, denn im Gleichschritt-Mehrspieler würde sie auf jedem Rechner mitlaufen. Sie
hat deshalb einen eigenen Zufallsgenerator mit Seed (z. B. für die Wahl der Bauplatz-Ecke) und durchläuft alles in
fester Reihenfolge.

## KI gegen KI ohne Bildschirm {#headless}

Weil die KI nur Befehle schickt und die Simulation keinen Bildschirm braucht, kann man zwei Computergegner gegeneinander
spielen lassen – in Node, so schnell der Prozessor kann. Das Skript `scripts/ai-match.js` macht genau das:

```js scripts/ai-match.js
const sim = new Sim({ seed });
const ais = diffs.map((d, i) => new AiPlayer(sim, i, d));
for (let t = 0; t < minutes * 600; t++) {
  for (const ai of ais) ai.update();
  const ev = sim.step();
  if (ev.some((e) => e.type === 'victory')) { console.log(`Victory team ${sim.winner} …`); break; }
  if (t % 3000 === 0) console.log(/* Gebäude, Arbeiter, Truppen, Vorräte je Spieler */);
}
```

Ausprobiert mit dem Code dieses Meilensteins – 30 Minuten Spielzeit in 13 Sekunden:

```text
$ node scripts/ai-match.js 1 30 normal normal
  0 min  P0: Bld 3 Wrk 0 Ser 8 Cpt 0/0 T0 | 300G 2300C 1600W …  gather  ||  P1: Bld 2 Wrk 0 Ser 4 …  gather
  5 min  P0: Bld 10 Wrk 14 Ser 13 Cpt 0/0 T1 | 125G 1235C 94W …  gather  ||  P1: Bld 10 Wrk 14 Ser 13 …  gather
 15 min  P0: Bld 22 Wrk 32 Ser 22 Cpt 0/0 T3 | 232G 1871C 393W …  gather  ||  P1: Bld 23 Wrk 33 Ser 22 …  gather
 20 min  P0: Bld 29 Wrk 39 Ser 22 Cpt 3/12 T4 | 237G 1709C 556W …  gather  ||  P1: Bld 29 Wrk 40 Ser 22 …  gather
 25 min  P0: Bld 36 Wrk 51 Ser 22 Cpt 5/20 T4 | 222G 1791C 350W …  attack  ||  P1: Bld 37 Wrk 55 Ser 22 …  gather
Runtime 13.0 s Rejections { 'Nicht genug Rohstoffe': 2 }
```

Man liest daraus einiges ab: Beide Seiten wachsen ähnlich schnell (gutes Zeichen für faire Karten), nach 20 Minuten
gibt es die ersten Hauptleute (`Cpt 3/12`: drei Hauptleute mit zwölf Soldaten), nach 25 Minuten greift Spieler 0 an.
Und die Zeile `Rejections` zählt, wie oft die Simulation einen KI-Befehl abgelehnt hat – ein guter Hinweis auf Denkfehler
in der KI. Heute läuft das Skript mit `node scripts/ai-match.js 1 60 hard easy` (Seed, Minuten, zwei Stufen).

## Was nicht klappte {#problems}

Die KI war anfangs zu gutgläubig. Die QA-Runde fand am nächsten Morgen, dass sie Leibeigene und Truppen immer wieder zu
unerreichbaren Zielen schickte – etwa zu einem Baum auf einer Insel. Jedes Mal durchsuchte A\* die ganze erreichbare
Karte, bevor er aufgab: bis zu 1 724 vergebliche Wegsuchen in 150 Sekunden und Ruckler von über einer Sekunde. Die
Lösung kam aus der Simulation: Gebietsnummern zeigen sofort, ob ein Ziel erreichbar ist (mehr dazu bei den
[QA-Runden](blog/qa-fog/#regions)), und die KI plant seitdem nur noch erreichbare Bauplätze und Ziele. Danach: null
Fehlversuche in denselben Partien.

## Zum Nachmachen {#tips}

- **Lass die KI über die öffentliche Befehlsschnittstelle spielen,** nie mit Sonderrechten – dann ist sie fair, und
  jeder ihrer Fehler ist auch ein Fehler, den ein Mensch machen könnte.
- **Fang mit einer Prioritätenliste an.** Eine KI aus „wenn … dann …“ und einer Wunschliste trägt erstaunlich weit
  und ist leicht zu verstehen.
- **KI gegen KI ohne Grafik ist der beste Dauertest** für Simulation, Balance und Leistung. Lass sie laufen, während
  du etwas anderes machst.
