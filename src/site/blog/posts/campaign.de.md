---
title: Kampagne „Krone aus Eis“ und gemalte Welt
date: 2026-10-04T23:17:24+02:00
teaser: Sechs Missionen „Krone aus Eis“ mit Helden, Diplomatie und Tributen – wie eine Mission als Daten mit Bedingungen und Aktionen gebaut ist, wie aus einem KI-Bild eine nahtlose Bodentextur wird, und warum eine halbe Erweiterung wieder verschwand.
milestone: true
---

## Worum es geht {#what}

Am Abend des 4. Oktober bekommt Kronland eine Geschichte. Die Leibeigenentochter Nelia findet unter einer alten
Wurzel die Zacke einer zerbrochenen Krone. Der Händler Orrin macht daraus sofort eine Legende: Nelia sei die
verlorene Prinzessin. Die Lüge wird nie aufgelöst, aber sie trägt die beiden durch sechs Missionen, bis zum Endgegner
Malvor, der mit einem alten Wetterwerk das Land im Winter hält.

Dafür braucht das Spiel neue Mechaniken:

- **mehrere Helden je Spieler** mit eigenen Fähigkeiten (Nelia, Orrin, später Taran),
- **Diplomatie** – Spieler können feindlich, neutral oder verbündet sein, Dörfer ohne Burg sind eigene Spielerplätze,
- **Gesprächsfiguren** mit Ausrufezeichen, die nur ein bestimmter Held ansprechen kann,
- **Tribute**: Angebote, die man bezahlen kann, oft als Wahl „kaufen oder kämpfen“.

Gleichzeitig wird die Welt „gemalt“: Sechs Bodentexturen und die App-Symbole kommen aus einer Bild-KI, und Bäume
bekommen Detailstufen nach ihrer Größe auf dem Bildschirm (wie die Figuren, siehe
[Artikel 10](blog/characters-coding/)).

![Mission 1 „Lindgrund“ am Abend des 4. Oktober: tiefer Winter, links oben die Ziele, darunter spricht Orrin. Burg und Häuser sind noch die KayKit-Modelle, die Bodentextur ist schon gemalt.](blog/campaign/c1-dialog.webp)

## Erst die Geschichte gegen die Mechanik prüfen {#story}

Die Geschichte kam als kurze Vorgabe vom Projektinhaber. Bevor eine einzige Mission entstand, wurde sie in einer
Konzeptnotiz (`docs/KAMPAGNE.md`) gegen die Mechaniken des Vorbilds abgeglichen. Grundsatz: nur Mechanik aus dem
Grundspiel. Fehlt etwas, wird die Geschichte angepasst oder die Mechanik des Originals nachgebaut, nie eine eigene
erfunden. Ein paar Beispiele aus der Tabelle:

| Vorgabe der Geschichte | Umsetzung im Spiel |
|---|---|
| Nahrung, Korn, Kornspeicher | Es gibt keinen Nahrungsrohstoff (wie im Original): Höfe versorgen Arbeiter direkt. Ziele heißen „Bett und Essen für Arbeiter“. |
| Kronenzacken | Missionsmerker (`flag`), kein Inventar – wie im Original. |
| Kaufen oder kämpfen | Tribute: zwei Angebote einer Gruppe schließen einander aus. |
| Taran wechselt die Seite | Er wird beim Gegner entfernt und beim Spieler neu eingesetzt. |
| Tauwetter | Wetterkraftwerk; wer bei Tauwetter auf dem Eis steht, ertrinkt. |

Das klingt nach Bürokratie, spart aber viel Arbeit: Jede neue Mechanik muss gebaut, getestet, in den Spielstand
aufgenommen, übersetzt und im Handbuch erklärt werden.

## Eine Mission ist eine Datei voller Daten {#mission}

Wie steuert man eine Mission? Man könnte für jede Mission eigenen Code schreiben, der jeden Takt prüft, was gerade
los ist. Kronland macht es anders: Eine Mission ist im Wesentlichen eine **Beschreibung** – ein JavaScript-Objekt mit
Spielern, Zielen und Ereignissen. Eine gemeinsame Laufzeit (`src/sim/missions/runtime.js`) arbeitet diese
Beschreibung ab. So sieht der Kopf von Mission 1 aus:

```js src/sim/missions/campaign/c1-lindgrund.js
export default {
  id: 'c1', seed: 1101, size: 96,
  title: t('Lindgrund', 'Lindgrund'),
  weatherCycle: [['winter', 18000], ['summer', 6000]],   // Takte: tiefer Winter
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin'], serfs: 6, stock: { gold: 500, clay: 1400, … } },
    { kind: 'bandits', look: 'soldiers' },
    { kind: 'village', name: 'neighbors' },
  ],
  setup(ctx) { … },     // Orte auf der Zufallskarte suchen
  start: [ say('nelia', 'Der Speicher ist leer. …'), … ],
  objectives: [ … ],
  npcs: { … },
  events: [ … ],
};
```

`t(de, en)` macht aus zwei Texten ein zweisprachiges Objekt – ein Test prüft, dass jede Missionsdatei beide Sprachen
enthält.

### Orte ohne feste Koordinaten

Die Karte von Mission 1 ist eine Zufallskarte mit festem Seed (1101). Statt Koordinaten festzuschreiben, sucht
`setup` die wichtigen Orte vom Hof aus: Die „alte Wurzel“ liegt 11 Kacheln Richtung Kartenmitte, das Nachbardorf
20 Kacheln zur Seite, die Eintreiber kommen aus 28 Kacheln Entfernung. Gefunden wird immer in derselben Reihenfolge,
darum ist das Ergebnis bei gleichem Seed immer gleich – deterministisch, wie alles in der Simulation.

```js
const root = site(ctx, api.toward(hq, mid, 11), { from: hq });
if (root) {
  api.plantTrees(sim, root, 6, 3);
  ctx.ref('oldRoot', { x: root.x, y: root.y, r: 2 });
}
```

### Ziele, Ereignisse, Aktionen

Ein **Ziel** hat einen Typ, den die Laufzeit kennt: `reach` (eine Figur erreicht einen Ort), `build` (so viele
Gebäude einer Art), `workers`, `destroy`, `flag` und einige mehr. Erfüllt sich ein Ziel, laufen seine Aktionen
(`onDone`). Ein **Ereignis** besteht aus einer Bedingung (`when`) und Aktionen (`do`). Bedingungen lassen sich mit
`any`, `all` und `not` verknüpfen – das ist nichts anderes als boolesche Logik mit Und, Oder und Nicht:

```js
{ id: 'collect',
  when: { type: 'any', of: [
    { type: 'time', at: 240 },
    { type: 'all', of: [{ type: 'objective', id: 'root' }, { type: 'time', at: 150 }] },
  ] },
  do: [
    { type: 'spawn', owner: 'bandits', ref: 'collectors', at: 'collectorFrom',
      units: [{ def: 'spear1', count: 2, soldiers: 2 }], order: 'attackMove', target: 'humanHq' },
    say('collector', 'Im Namen des Statthalters! …'),
    say('orrin', 'Eintreiber! Nelia, das sind nur ein paar Speerträger. …'),
    { type: 'reveal', id: 'collectors' },
    { type: 'camera', at: 'collectors' },
  ] },
```

![Das Ereignis aus Mission 1 als Baum: Die Eintreiber kommen nach 240 Sekunden – oder schon nach 150, wenn Nelia die Zacke gefunden hat.](blog/campaign/events-de.svg)

Dieses Muster heißt in der Informatik **Ereignis–Bedingung–Aktion** (englisch
[event-condition-action](https://en.wikipedia.org/wiki/Event_condition_action)). Datenbanken nutzen es für
*Trigger*, und auch das Vorbild arbeitet in seinen Missionen mit solchen Auslösern. Der große Vorteil von Daten statt
Code: Die Laufzeit ist einmal getestet, und eine neue Mission kann wenig falsch machen. Wo eine Aktion doch mehr
können muss, darf an ihrer Stelle eine Funktion `(sim, m) => { … }` stehen.

Weil die Laufzeit Teil der Simulation ist, gilt alles aus [Artikel 1](blog/simulation-core/): Sie läuft im festen
100-ms-Takt, und ihr Zustand (welche Ziele erfüllt, welche Ereignisse gefeuert sind) gehört in den Spielstand und in
den Zustands-Hash.

### Tribute: Bezahlen ist ein Befehl

Ein Tribut ist ein Angebot im Missionsfenster. Zwei Angebote mit derselben `group` schließen einander aus:

```js src/sim/missions/campaign/c4-eisenhain.js
tributes: {
  mercs:    { group: 'help', cost: { gold: 1400 },
              text: t('Söldner anheuern: 4 kampfbereite Truppen', …),
              onPaid: [{ type: 'spawn', owner: 'human', at: 'humanHq', units: [ … ] }, …] },
  refugees: { group: 'help', cost: { gold: 400 },
              text: t('Geflohene Leibeigene aufnehmen: 8 Leibeigene und Vorräte', …), … },
},
```

Spannend ist, wie der Knopf „Bezahlen“ wirkt. Die Oberfläche zieht nicht selbst Gold ab. Sie schickt der Simulation
einen **Befehl** `{ type: 'mission', action: 'tribute', id }`. Die Simulation prüft, ob das Angebot noch offen ist
und das Geld reicht, und lehnt sonst mit einem Fehlercode (`err.notEnoughResources`) ab. Das ist die Grundregel des
ganzen Spiels: Die einzige Eingabe der Simulation sind Befehle. Darum könnte man eine Partie auch übers Netz spielen,
indem man nur die Befehle austauscht.

![Mission 4 „Eisenhain“: zwei Angebote derselben Gruppe – Söldner für 1 400 Taler oder geflohene Leibeigene für 400. Wer eins bezahlt, verliert das andere.](blog/campaign/c4-tribute.webp)

### Missionen ohne Bildschirm testen

Wie testet man sechs Missionen, die jeweils eine halbe Stunde dauern? Mit einem Bot, der sie ohne Grafik durchspielt
(eingeführt in [Artikel 8](blog/qa-fog/)). Weil Simulation und Darstellung getrennt sind, läuft das Spiel in Node
genauso wie im Browser, nur viel schneller. `scripts/campaign-matrix.js` spielt alle Missionen auf mehreren Seeds und
meldet, wo der Bot hängen bleibt oder eine Mission zu leicht ist. Nach dem ersten Wurf von Mission 3 war das Ergebnis
eindeutig: Sie wurde neu gebaut, mit einem Tal, in das ein stark bewachtes Tor oder eine zugefrorene Schlucht führt.

## Gemalte Böden {#ground}

Bisher malte der Code die Bodentexturen selbst, mit Rauschfunktionen. Jetzt kommen sie aus einer Bild-KI. Das
klingt einfach – Bild bestellen, fertig –, hat aber einen Haken: Eine Bodentextur wird gekachelt, also wie Fliesen
viele Male nebeneinandergelegt. Passen linker und rechter Rand nicht zusammen, sieht man auf der ganzen Karte ein
Gitter aus Nähten. Bildmodelle liefern trotz der Bitte „seamless tileable“ fast nie wirklich kachelbare Bilder.

### Der Trick mit der verschobenen Kopie

Das Skript `scripts/asset-gen/groundtex.mjs` macht jedes Bild in zwei Durchgängen kachelbar, erst waagrecht, dann
senkrecht. In jedem Durchgang:

1. Verschiebe eine Kopie des Bildes um die halbe Breite (was rechts herausfällt, kommt links wieder herein). Die Kopie
   ist an ihrem Rand automatisch nahtlos – dort stoßen ja zwei Stellen aneinander, die im Original nebeneinanderlagen.
   Dafür hat sie jetzt in der Mitte eine Naht.
2. Mische Original und Kopie: am Rand nur die Kopie, in der Mitte nur das Original, dazwischen ein weicher Übergang
   über 22 % der Breite.

![Ein Durchgang: Das Original (A|B) hat am Rand eine Naht, die verschobene Kopie (B|A) in der Mitte. Die Gewichtskurve unten nimmt von jedem Bild nur die gute Stelle.](blog/campaign/seamless-steps-de.svg)

```js scripts/asset-gen/groundtex.mjs
const smooth = (t) => t * t * (3 - 2 * t);           // weiche S-Kurve
export function edgeWeight(i, n, band) {              // 0 am Rand, 1 in der Mitte
  const d = Math.min(i + 0.5, n - i - 0.5) / Math.max(1, band * n);
  return smooth(Math.max(0, Math.min(1, d)));
}
// je Pixel: Original a, um die halbe Breite verschobene Kopie b, Gewicht t
const m = t + (helligkeit(a) − helligkeit(b)) · 3 · t · (1 − t) · 4;  // Hellere setzt sich durch
out = a · m + b · (1 − m);
```

Die S-Kurve `t² · (3 − 2t)` heißt [Smoothstep](https://en.wikipedia.org/wiki/Smoothstep) und taucht in der
Computergrafik überall auf, wo etwas sanft beginnen und enden soll. Der Zusatz mit der Helligkeit verhindert einen
„Doppelbelichtungs“-Streifen: Statt zwei Grashalme halb durchsichtig übereinanderzulegen, gewinnt im Übergang der
hellere.

Ob es geklappt hat, misst das Skript auch: `seamRatio` vergleicht den Farbsprung über die Kachelgrenze mit dem
typischen Sprung zwischen Nachbarpixeln im Bild. Ein Wert um 1 heißt: An der Naht passiert nicht mehr als anderswo.

![Probe mit einem beliebigen Ausschnitt der Wiesentextur, je 2 × 2 gekachelt. Links unbearbeitet: An den roten Marken sieht man die Nähte (Kennzahl 2,5). Rechts nach makeSeamless: Kennzahl 1,0, die Nähte sind verschwunden.](blog/campaign/seamless.webp)

Danach wird noch die mittlere Farbe auf die Farbwelt des Spiels geschoben – Bildmodelle malen gern zu grell. Die
Hell-dunkel-Unterschiede des Bildes bleiben dabei erhalten. Je Bodenart entstanden mehrere Kandidaten, die auf einem
Übersichtsbogen 2 × 2 gekachelt verglichen wurden.

## Was nicht klappte {#problems}

- **Zu viel Inhalt:** Wirtshaus, Dieb, Kundschafter und Büchsenschützen aus der Erweiterung ([Artikel 9](blog/first-wave/))
  passten nicht zur Kampagne. Sie wurden wieder entfernt, nur Brücken, Brunnen und Denkmal blieben. Der Meilenstein
  löscht deshalb fast 4 000 Zeilen, fast so viele, wie er hinzufügt.
- **Mission 3** wurde nach dem ersten Wurf neu gebaut (Tal, Tor oder Schlucht, Tauwetter).
- **Bodentexturen** mit einzelnen auffälligen Formen – ein großer Stein, eine dunkle Blume – wiederholen sich sichtbar,
  egal wie nahtlos. Gut sind gleichmäßige Bilder ohne dunklen Rand.
- **Alte Helden:** Die bisherigen Helden lagen in Aussehen und Fähigkeitsnamen zu nah am Original und wurden durch
  eigene ersetzt.

## Zum Nachmachen {#tips}

- Beschreibe Missionen als Daten (Bedingungen und Aktionen) und schreib die Laufzeit nur einmal.
- Lass die Oberfläche nie selbst den Spielzustand ändern – sie schickt Befehle, die Simulation prüft sie.
- Kachel Texturkandidaten, bevor du wählst – Wiederholung sieht man nur im Verbund.
- Erst die Geschichte gegen die Mechanik prüfen, dann Missionen schreiben.
- Streichen ist mit Agenten billig, Pflegen nicht: Was nicht passt, darf wieder gehen.
