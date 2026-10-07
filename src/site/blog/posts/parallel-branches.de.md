---
title: Parallele Zweige: Missionen, Spielsysteme, Ton, HUD
date: 2026-10-04T02:45:55+02:00
teaser: Fünf Zweige gleichzeitig – Missionen, Spielsysteme, Grafik, Ton und ein zweisprachiges HUD – und eine Nacht, in der alles zusammenkommt. Wie arbeitet man parallel, ohne sich gegenseitig zu zerschießen?
milestone: true
---

## Was entstand {#what}

Am Abend des 3. Oktober arbeiten zum ersten Mal mehrere Zweige parallel, jeder in einer eigenen Agenten-Sitzung:

- **Missionen:** eine Laufzeit mit Zielen, Auslösern und Aktionen, ein Tutorial, eine Kampagne mit fünf Missionen.
- **Spielsysteme:** Gebäude-Technologien, Marktplatz mit gemeinsamen Preisen, Wetterturm und Wetterkraftwerk,
  Erfahrung der Hauptleute, Brand, Reparatur und Ruinen.
- **Grafik:** Detailstufen, GPU-Instanzen für Figuren mit Animationen in einer Knochen-Textur, Partikeleffekte.
- **Ton:** 38 synthetisierte Effekte, generative Musik (Laute, Harfe, Flöte), Umgebungsklänge.
- **Oberfläche:** Deutsch und Englisch, ein neues HUD in Holz, Pergament und Messing, Handy hoch und quer mit
  Tippzielen von mindestens 44 Pixeln.

Mit 297 geänderten Dateien und 142 neuen Vitest-Tests ist das der größte Schritt bis dahin.

![Das neue HUD auf dem Desktop (links, mit Minikarte und Infotafel) und auf dem Handy im Hochformat (rechts). Die Siedlung links hat wieder dasselbe Testskript gebaut wie in den vorigen Artikeln.](blog/parallel-branches/hud.webp)

## Zweige: parallele Welten im Repository {#branches}

[Git](https://de.wikipedia.org/wiki/Git) speichert die Geschichte eines Projekts als Folge von Commits. Ein **Zweig**
(*branch*) ist eine eigene Linie in dieser Geschichte: Man zweigt vom Hauptzweig `main` ab, arbeitet dort, ohne die
anderen zu stören, und führt die Änderungen am Ende wieder zusammen (*merge*). Fünf Sitzungen können so gleichzeitig
an fünf Zweigen arbeiten.

![Fünf Zweige zweigen am Abend von main ab und werden in der Nacht nacheinander zurückgeführt – der Oberflächen-Zweig zuletzt (schematisch).](blog/parallel-branches/branches-de.svg)

Das Risiko: Zwei Zweige ändern dieselbe Stelle einer Datei unterschiedlich. Dann entsteht beim Zusammenführen ein
**Konflikt**, und jemand muss entscheiden, welche Fassung gilt – oder beide kombinieren. Je mehr Zweige dieselben
Dateien anfassen, desto schmerzhafter wird das.

## Schnittstellen statt Umbauten {#interfaces}

Die wichtigste Vorbereitung war deshalb, die Arbeit **entlang der Architektur** aufzuteilen. Simulation, Darstellung,
Ton und Oberfläche sind getrennte Schichten (siehe [Simulationskern](blog/simulation-core/#commands)), also bekam jeder
Zweig im Wesentlichen eigene Dateien. Wo sich Zweige doch berühren mussten, wurden kleine, dokumentierte
**Erweiterungspunkte** eingebaut, statt bestehenden Code umzubauen:

- Die Missionen hängen sich über drei Haken in die Simulation ein: beim Aufbau der Karte, in jedem Takt und bei jedem
  Befehl.
- Neue Gebäudefenster registrieren sich mit `registerBuildingSection(fn)` – das Infofenster ruft einfach alle
  registrierten Funktionen auf.
- Der Ton hört auf die Ereignisse, die die Simulation ohnehin meldet (`buildingDone`, `shot`, `killed` …), und braucht
  dafür keine einzige Zeile in der Simulation.

Das ist das [Offen-geschlossen-Prinzip](https://de.wikipedia.org/wiki/Open-Closed-Prinzip) in der Praxis: offen für
Erweiterungen, geschlossen für Änderungen.

## Missionen als Daten {#missions}

Eine Mission ist bei Kronland eine JavaScript-Datei, die vor allem *beschreibt*, statt zu programmieren: Karte,
Startvorräte, Ziele, Ereignisse. Ein Ausschnitt aus der zweiten Kampagnenmission, in der Räuber in drei Wellen angreifen:

```js src/sim/missions/campaign/c2-fire.js
objectives: [
  { id: 'barracks', type: 'build', building: 'barracks', primary: true, text: t('Baue eine Kaserne', 'Build a barracks') },
  { id: 'army', type: 'recruit', count: 3, primary: true, text: t('Hebe 3 Einheiten aus', 'Recruit 3 units') },
  { id: 'survive', type: 'survive', until: 540, primary: true, text: t('Überstehe die Angriffe', 'Survive the attacks') },
  { id: 'protectVc', type: 'protect', ref: 'village', primary: true, text: t('Das Dorfzentrum muss stehen bleiben', '…') },
],
events: [
  {
    id: 'wave1',
    when: { type: 'time', at: 150 },                       // Auslöser: nach 150 Sekunden
    do: [                                                  // Aktionen
      say('kunz', 'Holt euch das Dorf, Jungs! …', 'Take the village, lads! …'),
      { type: 'spawn', owner: 'bandits', at: 'banditGate', units: [{ def: 'sword1', count: 2, soldiers: 2 }],
        order: 'attackMove', target: 'village' },
      { type: 'camera', at: 'banditGate' },
    ],
  },
  …
],
```

Das Muster heißt *Auslöser → Aktionen* (englisch *triggers*) und ist in Strategiespielen und ihren Karteneditoren weit
verbreitet. Die Missions-Laufzeit prüft in jedem Takt alle Auslöser und Ziele. Weil sie in der Simulation läuft, gilt
auch für sie: nur ganze Zahlen, feste Reihenfolge, kein `Math.random` – und ihr Zustand wird mit dem Spielstand
gespeichert. Texte stehen gleich zweisprachig im Objekt (`t('…', '…')`).

## Hunderte Figuren auf der Grafikkarte {#graphics}

Bisher war jede Figur eine eigene Gruppe aus Meshes. Bei 300 Figuren bedeutet das tausende Zeichenaufrufe pro Bild – zu
viel für ein Handy. Der Grafik-Zweig stellte deshalb auf **Instanzen** um, wie es bei den Bäumen schon von Anfang an
war (siehe [3D-Darstellung](blog/rendering/#instancing)). Bei Figuren ist das schwieriger, denn sie bewegen sich: Jede
hat ihre eigene Pose.

![Einzeln zeichnen oder instanziert: Bei Instanzen bekommt die Grafikkarte die Form einmal und eine Tabelle mit ein paar Zahlen pro Figur.](blog/parallel-branches/instancing-de.svg)

Der Trick: Beim Laden wird jede Animation „gebacken“. Für jedes Einzelbild (24 pro Sekunde) und jeden Knochen des
Skeletts wird die Lage als 4 × 4-[Matrix](https://de.wikipedia.org/wiki/Matrix_%28Mathematik%29) berechnet und in eine
Textur geschrieben – eine *Knochen-Textur*. Pro Bild bekommt jede Figur dann nur noch wenige Zahlen: ihre Position,
welches Animationsbild gerade dran ist, ihre Spielerfarbe. Die Grafikkarte schlägt die passenden Knochen-Matrizen
selbst nach und verformt das Modell (*Skinning*). Hunderte Figuren kosten so eine Handvoll Zeichenaufrufe.

Dazu kommen **Detailstufen** (*Level of Detail*, LOD): Eine Figur, die auf dem Bildschirm nur zehn Pixel hoch ist,
braucht nicht 2 000 Dreiecke. Je nach Abstand zur Kamera wird ein einfacheres Modell gezeichnet. Damit Figuren an einer
Schwelle nicht ständig hin- und herspringen, gibt es eine [Hysterese](https://de.wikipedia.org/wiki/Hysterese): Zum
Vereinfachen muss man etwas weiter weg sein als zum Zurückschalten – wie bei einem Thermostat.

## Musik aus Formeln {#sound}

Der Ton-Zweig hatte eine besondere Vorgabe: zunächst keine Audiodateien, alles im Browser erzeugt (mit der
[Web Audio API](https://developer.mozilla.org/de/docs/Web/API/Web_Audio_API)). Für gezupfte Saiten – Laute und Harfe –
benutzt er den [Karplus-Strong-Algorithmus](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis),
einen der elegantesten Algorithmen der Klangsynthese:

```pseudo
puffer = n zufällige Werte          # n = Abtastrate / Tonhöhe, z. B. 44100 / 220 = 200
wiederhole für jeden Ausgabewert:
  ausgabe = puffer[i]
  puffer[i] = (puffer[i] + puffer[i+1]) / 2 · dämpfung   # Mittelwert = Tiefpass
  i = (i + 1) mod n
```

Ein Puffer voller Rauschen wird immer wieder durchlaufen und dabei jedes Mal ein wenig geglättet. Das Rauschen
„schwingt sich ein“ auf die Periode der Pufferlänge – man hört einen Ton der Frequenz Abtastrate / n –, und die hohen
Anteile klingen zuerst ab, genau wie bei einer echten Saite. In `src/audio/karplus.js` steckt diese Schleife in gut
40 Zeilen. Die Musik selbst entsteht aus Tonleitern und Akkordfolgen, die ein Zufallsgenerator mit Seed variiert.
(Später ersetzten komponierte Musikstücke die Formelmusik; die Effekte aus Formeln blieben teilweise.)

## Zwei Sprachen von Anfang an {#i18n}

Der Oberflächen-Zweig machte das Spiel zweisprachig. Alle Texte der Oberfläche stehen seitdem in zwei Wörterbüchern
mit flachen Schlüsseln, und `t()` schlägt sie in der aktuellen Sprache nach ([Internationalisierung](https://de.wikipedia.org/wiki/Internationalisierung_%28Softwareentwicklung%29)):

```js src/i18n/de.js
'err.notEnoughResources': 'Nicht genug Rohstoffe',
```

```js src/i18n/en.js
'err.notEnoughResources': 'Not enough resources',
```

Interessant ist die Grenze zur Simulation: Die Simulation kennt keine Sprache. Lehnt sie einen Befehl ab, meldet sie
einen **Code** wie `err.notEnoughResources`, und erst die Oberfläche macht daraus einen Satz. Das hält die Simulation
sauber – und im Mehrspieler könnte jeder Spieler eine andere Sprache haben.

## Was nicht klappte {#problems}

Das Zusammenführen war der schwerste Teil. Der Oberflächen-Zweig wurde bewusst zuletzt gemergt, weil er alles anfasst,
was die anderen sichtbar machen: Er musste das neue HUD, die Zweisprachigkeit, die neuen Spielsysteme, die Grafik und
den Ton zusammenbringen. Fertig war das um 02:45 Uhr nachts. Dabei wurden auch die deutschen Ablehnungstexte der Simulation durch Codes
ersetzt – eine Änderung quer durch viele Dateien.

Ein Rekrutier-Test schlug nach dem Zusammenführen unter Software-Grafik fehl: Der Simulationstakt kam unter Last später,
und der Test schaute zu früh nach. Er wartet seitdem länger.

## Zum Nachmachen {#tips}

- **Plane parallele Arbeit entlang der Architektur-Schichten** und lege vorher Schnittstellen fest.
- **Führe den Zweig mit den meisten Querbezügen zuletzt zusammen** (bei uns die Oberfläche).
- **Texte von Anfang an über Schlüssel und Wörterbücher** – nachträgliche Zweisprachigkeit kostet einen ganzen Zweig.
- **Hör dir Karplus-Strong an:** Die Schleife oben passt in zehn Zeilen JavaScript mit der Web Audio API und ist ein
  schönes Wochenendexperiment.
