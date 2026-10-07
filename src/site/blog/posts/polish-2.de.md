---
title: Feinschliff II: Meldungen, Kreisplätze, Ton, Blog
date: 2026-10-06T21:56:46+02:00
teaser: Neun Aufgaben an einem Abend. Wie Meldungen Vorrang bekommen, wie Figuren mit einer Tabelle aus 19 Zahlen im Kreis um ein Feuer sitzen, warum Klicks ins Gras unsichtbare Figuren trafen – und wie aus der Git-Geschichte dieser Blog wurde.
milestone: true
---

## Worum es geht {#what}

Am Abend des 6. Oktober laufen neun Zweige parallel und werden nacheinander in `main` zusammengeführt:

- **Meldungen** bekommen Kategorien mit Vorrang, gleiche Meldungen werden gebündelt („×3“), Angriff, Brand und ein
  bewusstloser Held bleiben als Dauerwarnung stehen.
- **Kreisplätze:** Rastende, Wartende und Holzfäller stehen auf festen Punkten eines Kreises um ihr Ziel statt in
  Kachelmitten.
- **Weibliche Figuren** heißen „Bäuerin“ oder „Schwertkämpferin“, zeigen ihr eigenes Porträt und rufen mit der
  Frauenstimme.
- **Warnruf und Kampfmusik:** Auch getroffene Soldaten rufen um Hilfe, und die Kampfmusik endet kurz nach dem letzten
  eigenen Treffer.
- **Schaukasten:** Das Dauer-Klingeln beim Einzug vieler Arbeiter ist weg.
- **Auswahl:** Ein Klick ins Leere wählt keine Figur mehr, die außerhalb des Bildes steht.
- **Links:** Karten lassen sich per Link teilen.
- **Kopfleiste:** Glaube steht immer da, bei 0 ausgegraut statt als Lücke.
- **Blog:** ein Artikel je Meilenstein, mit Kennzahlen und Link zum Quellcode des jeweiligen Stands.

## Meldungen mit Vorrang {#notices}

In einer großen Partie passiert ständig etwas: Ein Gebäude ist fertig, ein Trupp wird befördert, ein Handel
abgeschlossen, das Wetter schlägt um. Bisher erschien für jedes Ereignis eine Meldung unten im Bild, und die
wichtigen gingen zwischen den unwichtigen unter. „Dein Dorf wird angegriffen“ darf nicht hinter „Trupp befördert“
verschwinden.

### Kategorien

Jede Meldung gehört jetzt zu einer **Kategorie**. Jede Kategorie hat einen Vorrang (kleiner = wichtiger) und eine
Grenze, wie viele ihrer Meldungen gleichzeitig zu sehen sein dürfen:

```js src/game/notices.js
export const CATEGORIES = {
  alarm:    { prio: 0, limit: 2 },  // Angriff, Gebäude zerstört, Held bewusstlos
  fire:     { prio: 1, limit: 1 },  // brennende Gebäude
  feedback: { prio: 2, limit: 1 },  // Antwort auf eigene Eingaben (err.*)
  system:   { prio: 3, limit: 1 },  // Speichern, Laden
  build:    { prio: 4, limit: 2 },  // Gebäude fertig, repariert
  research: { prio: 5, limit: 1 },
  economy:  { prio: 6, limit: 2 },  // Handel, Rohstoffe erschöpft, Lagerfeuer
  military: { prio: 7, limit: 2 },  // rekrutiert, befördert
  world:    { prio: 8, limit: 1 },  // Wetter, Brücke eingestürzt
  info:     { prio: 9, limit: 1 },
};
```

Kommt eine neue Meldung, prüft `addNotice` zuerst, ob es dieselbe schon gibt (gleicher Schlüssel, gleiche Parameter).
Dann zählt nur der Zähler hoch, und aus fünf Meldungen wird eine mit „×5“. Manche Meldungen werden auch mit
unterschiedlichen Parametern zusammengefasst: „12 Beförderungen – zuletzt …“. Danach wird die Grenze der Kategorie
eingehalten – die älteste fällt heraus. Angezeigt werden höchstens fünf Meldungen (am Handy vier), die wichtigste
Kategorie oben.

Das Ganze ist eine **reine Funktion** auf einer Liste: Sie bekommt Liste, Meldung und Uhrzeit und gibt das Ergebnis
zurück, ohne Bildschirm und ohne Engine. Deshalb lässt sie sich mit Vitest gründlich testen – und die Uhrzeit kommt
als Parameter, sodass ein Test „zehn Sekunden später“ einfach als Zahl übergibt.

### Dauerwarnungen aus dem Zustand

Für Angriffe und Brände reicht eine kurze Meldung nicht: Solange das Dorf brennt, soll die Warnung stehen bleiben.
Der naheliegende Weg wäre, beim Ereignis „Brand“ eine Meldung anzulegen und beim Ereignis „gelöscht“ wieder zu
entfernen. Das ist fehleranfällig: Geht ein Ereignis verloren – etwa beim Laden eines Spielstands –, bleibt die
Warnung für immer stehen oder kommt nie.

Kronland macht es umgekehrt: Die Dauerwarnungen werden **bei jedem Aktualisieren der Oberfläche neu aus dem
Spielzustand gebaut**. Gibt es gerade Angriffsstellen? Brennende Gebäude? Bewusstlose Helden? Dann gibt es eine
Warnung, sonst nicht. In der Informatik nennt man so etwas *abgeleiteten Zustand*: Man speichert ihn nicht, man
berechnet ihn aus dem, was ohnehin da ist. Er kann deshalb nie veralten.

### Klingeln drosseln

Im Schaukasten (der Sonderkarte mit allen Modellen) zog gut einmal pro Sekunde ein Arbeiter ein, und jeder Einzug spielte
einen Harfenklang – ein Dauer-Klingeln. Eine Abklingzeit von 0,4 Sekunden je Klang half nicht, denn die Einzüge kamen
seltener als das. Die Lösung ist eine Ruhezeit **je Ereignisart**: Nach einem Einzugsklang sind acht Sekunden lang alle
weiteren Einzüge still, nach einer Beförderung fünf.

```js src/audio/notify.js
export const NOTIFY_REST = { workerArrived: 8, promoted: 5 };

admit(kind, now) {
  const r = this.rest[kind];
  if (!r) return true;                                 // keine Regel: immer
  const t = this.last.get(kind) ?? -Infinity;         // Zeitpunkt des letzten Klangs
  if (now >= t && now - t < r) return false;
  return true;
}
```

## Kreisplätze {#spots}

Seit [Artikel 14](blog/loading-performance/) hat jede arbeitende Figur einen eigenen Platz. Bisher war das eine
**Kachel** neben dem Ziel. Das sah steif aus: Vier Holzfäller um einen Baum standen in einem Quadrat, Arbeiter am
Lagerfeuer in einem Raster. Jetzt stehen sie auf einem **Kreis**.

![Arbeiter am Lagerfeuer nach diesem Meilenstein: im Kreis um das Feuer, alle blicken hinein (rechts verdeckt ein Busch zwei von ihnen).](blog/polish-2/campfire.webp)

### Richtungen ohne Kommazahlen

Ein Kreis braucht Sinus und Kosinus. Die Simulation darf aber kein `Math.sin` benutzen, weil das nicht auf jedem
Rechner bitgleich ist (siehe [Artikel 1](blog/simulation-core/)). Schon beim Umzingeln im Nahkampf (siehe
[Artikel 15](blog/polish/)) gab es deshalb eine Tabelle mit 24 Richtungen im 15°-Raster. Für die Kreisplätze wird sie
feiner und wandert in eine eigene Datei:

```js src/sim/dirs.js
/** sin(0°, 5°, …, 90°) × 1000, gerundet. */
const SIN5 = [0, 87, 174, 259, 342, 423, 500, 574, 643, 707, 766, 819, 866, 906, 940, 966, 985, 996, 1000];

const sin72 = (i) => {
  const j = ((i % 72) + 72) % 72;
  return j <= 18 ? SIN5[j] : j <= 36 ? SIN5[36 - j] : -sin72(j - 36);
};

/** 72 Richtungen im 5°-Raster (Länge 1000), Index 0 = +x, gegen den Uhrzeigersinn. */
export const DIR72 = Array.from({ length: 72 }, (_, k) => ({ x: sin72(k + 18), y: sin72(k) }));

/** Teiler von 72 – so viele Plätze passen gleichmäßig auf einen Kreis aus DIR72. */
export const RING_SIZES = [72, 36, 24, 18, 12, 9, 8, 6, 4, 3, 2, 1];
```

19 Zahlen ergeben 72 Richtungen. Ein Platz auf dem Kreis ist dann einfach Mittelpunkt + Richtung × Radius / 1000 – nur
Ganzzahlen.

### Wie viele Plätze passen?

Am Lagerfeuer und am Baum ist es einfach: acht Plätze, Radius 1,1 bzw. 0,9 Kacheln. Bei Gebäuden hängt es von der
Größe ab. Der innere Kreis liegt eine halbe Diagonale plus 0,4 Kacheln vom Mittelpunkt entfernt, ein zweiter 0,9
Kacheln weiter außen. Wie viele Plätze ein Kreis bekommt, berechnet die Simulation: den größten Teiler von 72, bei dem
benachbarte Plätze noch mindestens eine Kachel Abstand haben.

```js src/sim/systems/spots.js
function ringSize(radius, spacing) {
  const circ = idiv(radius * 6283, 1000);            // Umfang = 2π · r, als Ganzzahl
  for (const n of RING_SIZES) if (idiv(circ, n) >= spacing) return n;
  return 1;
}
```

`6283` ist 2π × 1000 – wieder ein Weg, mit Ganzzahlen zu rechnen. Für ein Gebäude mit 3 × 3 Kacheln ergibt das innen
12 und außen 18 Plätze; der äußere Kreis ist um einen halben Platz gedreht, damit niemand genau hinter jemandem steht.

![Links das Lagerfeuer mit 8 Plätzen, rechts ein 3 × 3-Gebäude mit zwei Ringen. Rechnung am Rand.](blog/polish-2/circle-spots-de.svg)

### Ein neues Feld im Spielstand

Der Platz einer Figur steht in `e.slot` und gehört damit zum Spielzustand: Er geht in den Zustands-Hash und in den
Spielstand ein. Was passiert mit alten Spielständen, in denen Figuren noch einen Kachelplatz `e.spot` haben? Genau
dafür gibt es die Migrationen aus [Artikel 9](blog/first-wave/): Beim Laden wird der alte Kachelplatz verworfen, und die
Figur wählt im nächsten Takt einen Kreisplatz.

## Eine Quelle für „weiblich“ {#sex}

Seit [Artikel 13](blog/own-art/) gibt es jeden Beruf als Mann und Frau. Welche Variante eine Figur bekommt, entscheidet
die Darstellung über einen Hash ihrer ID – die Simulation weiß davon nichts. Jetzt sollen auch der Name in der
Auswahlkarte („Bäuerin“), das Porträt und die Stimme passen. Die Gefahr: Drei Stellen entscheiden je für sich und
widersprechen sich.

Die Lösung ist eine einzige Quelle: Das Figuren-Manifest trägt an jeder Variante `"sex": "m"` oder `"f"`, und Darstellung,
Auswahlkarte und Ton fragen alle dieselbe reine Funktion `figureSex(manifest, rolle, id)`. In der Softwaretechnik heißt
dieses Prinzip [Single Source of Truth](https://de.wikipedia.org/wiki/Single_Source_of_Truth).

## Klicks ins Leere {#picking}

Wer klickt, will die Figur unter dem Mauszeiger wählen. Dafür projiziert die Darstellung für jede gezeichnete Figur
Fuß- und Kopfpunkt auf den Bildschirm und prüft, ob der Klick nah genug an der Linie dazwischen liegt. Der Fangradius
wächst mit der Größe der Figur auf dem Bildschirm – eine nahe Figur trifft man leichter.

Auf der Karte „Gewimmel“ wählten über 80 % der Klicks auf leeres Gras trotzdem eine Figur – eine, die gar nicht zu
sehen war. Der Grund liegt in der Mathematik der
[perspektivischen Projektion](https://de.wikipedia.org/wiki/Zentralprojektion): Um einen Punkt auf den Bildschirm zu
bringen, teilt man durch seine Tiefe. Liegt der Punkt **hinter** der Kamera, ist die Tiefe negativ – und die Rechnung
liefert trotzdem eine Zahl, nur gespiegelt und oft riesig. Ähnlich geht es Punkten, die zwischen Kamera und
Nahebene liegen. Figuren knapp hinter oder unter der Kamera bekamen so gewaltige Bildschirmkoordinaten und damit einen
gewaltigen Fangradius.

![Seitenansicht: Eine Figur vor der Kamera landet richtig auf der Bildebene, eine Figur knapp dahinter wird durch den Brennpunkt gespiegelt.](blog/polish-2/pick-behind-camera-de.svg)

Die Korrektur ist kurz. Nach der Projektion liegt jeder Punkt in *normierten Gerätekoordinaten*; die z-Werte
zwischen −1 und 1 sind genau das, was zwischen Nah- und Fernebene der Kamera liegt. Alles andere zählt nicht:

```js src/render/pick.js
export function inDepth(z) { return Number.isFinite(z) && z >= -1 && z <= 1; }

export function figurePickDistance(f, px, py, view) {
  if (!f.drawn || !inDepth(f.az) || !inDepth(f.bz)) return Infinity;   // nicht gezeichnet oder hinter der Kamera
  …
  if (qx < 0 || qy < 0 || qx > view.width || qy > view.height) return Infinity;  // Trefferpunkt nicht im Bild
  const radius = Math.min(PICK_MAX_PX, Math.max(view.touch ? PICK_MIN_TOUCH_PX : PICK_MIN_PX, len * PICK_WIDTH));
  return d <= radius ? d : Infinity;
}
```

Auch das ist eine reine Funktion ohne three.js und ohne Browser – mit Tests, die genau den Fall „Figur hinter der
Kamera“ nachstellen. Am Handy ist der kleinste Fangradius übrigens größer (16 statt 9 Pixel), weil Finger ungenauer
sind als ein Mauszeiger.

## Karten per Link {#links}

Ein Link wie `play/?seed=4711&ai=hard` beschreibt den **Start** einer Partie: Seed, Gegner, Held, Nebel – oder eine
Mission. Weil die Simulation deterministisch ist, erzeugt derselbe Seed auf jedem Rechner dieselbe Karte. Ein paar
Zahlen in der Adresse genügen also, um eine Karte zu teilen; die Karte selbst muss nicht mit. Parameter, die nur die
eigene Darstellung betreffen (Grafikstufe, Entwicklermodus), bleiben dabei bewusst draußen.

## Wie dieser Blog entstand {#blog}

Die letzte der neun Aufgaben war dieser Blog. Seine Grundlage ist die Git-Geschichte des Projekts: Jeder Meilenstein
ist ein Commit, und eine Datei `docs/milestones.json` hält zu jedem fest, wann er begann und endete, wie viele Dateien
und Zeilen er änderte und wie viele Tests es danach gab. Ein Skript (`scripts/milestones.mjs`) zählt diese Werte aus
der Geschichte selbst, statt sie von Hand abzuschreiben. Die Artikel sind Markdown-Dateien je Sprache, die
Blogseiten entstehen beim Build, und jeder Artikel verlinkt den Quellcode genau seines Stands.

Die neun Zweige wurden **nacheinander** zusammengeführt: Jeder bekam zuerst den aktuellen Stand von `main`, Konflikte
wurden so gelöst, dass das Verhalten beider Seiten erhalten blieb, dann liefen `npm test`, der Build und die
betroffenen E2E-Tests. So blieb nach jedem Schritt klar, welcher Zusammenschluss etwas kaputt gemacht hätte.

## Was nicht klappte {#problems}

- **Klingeln:** Die Abklingzeit von 0,4 s half nicht, weil die Einzüge seltener kamen; erst Ruhezeiten je Ereignisart
  beendeten es.
- **Phantom-Auswahl:** Figuren knapp hinter der Kamera bekamen riesige Bildkoordinaten – über 80 % der Klicks ins
  Gras wählten im Gewimmel eine unsichtbare Figur.
- **Stumme Truppen:** Meist wird ein Soldat getroffen, nicht der Hauptmann. Soldaten hatten aber keine Sprechrolle,
  und die Miliz bekam Sätze ohne Aufnahme. Beim Zusammenführen mit den weiblichen Figuren musste die Miliz zudem wieder
  mit der Leibeigenen-Stimme ihres Geschlechts rufen.
- **Zu lange Kampfmusik:** Sie hing an einer langsam abklingenden „Hitze“ und lief nach großen Kämpfen noch eine halbe
  Minute nach. Auch fremde Kämpfe im Bild lösten sie aus.
- **Langsame Tests:** Unter Software-Grafik schafften E2E-Tests zu wenige Takte; der Lagerfeuer-Test spult jetzt mit
  `stepOnce` vor.

## Zum Nachmachen {#tips}

- Drossle Klänge aus Massenereignissen je Ereignisart, nicht je Einzelfall.
- Lege Eigenschaften wie das Geschlecht an genau einer Stelle fest und lies sie überall über dieselbe Funktion.
- Baue Dauerzustände wie „wird angegriffen“ jedes Mal neu aus dem Zustand auf, statt sie als Meldung mitzuschleppen.
- Prüfe nach einer Projektion, ob der Punkt überhaupt vor der Kamera liegt.
- Führe parallele Zweige einzeln nacheinander zusammen und teste nach jedem Schritt.
