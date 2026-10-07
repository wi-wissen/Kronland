---
title: Eigene Grafik statt KayKit
date: 2026-10-05T22:54:41+02:00
teaser: Der größte Zweig: Gebäude in drei Stufen, 24 Berufe, Soldaten, Helden, Bäume – alles eigene Modelle aus Bild-KI und Meshy. Wie eine Asset-Pipeline aussieht, warum Texturen Lücken füllen müssen, wie ein Schwert starr in der Hand bleibt und wie aus 1 470 MB 16 MB werden.
milestone: true
---

## Worum es geht {#what}

Seit [Artikel 5](blog/first-package/) standen im Spiel die freien Modelle des KayKit-Pakets: ordentlich, aber
erkennbar „Baukasten“, und mit Gebäuden, die nicht zu allen Ausbaustufen des Spiels passten. Dieser Meilenstein
ersetzt fast alles durch eigene Modelle. Die Arbeit lief vom Abend des 4. bis zum Abend des 5. Oktober, über einen Tag
lang, und ist der größte Zweig des Projekts.

Danach hat Kronland eigene Grafik für:

- alle **Gebäude** in ihren Ausbaustufen (66 Modelle),
- **24 Berufe**, jeweils als Mann und Frau,
- **Soldaten**, Reiter, Helden, Räuber,
- **Bäume** mit Winterfassung, Brücke, Ruinen, Lagerfeuer, Porträts und eine Kanone.

Vom KayKit-Paket bleiben nur Baugerüst, Bauphasen, Trümmer und Felsen.

![Vorher: Mission 4 „Eisenhain“ mit den KayKit-Modellen (Stand von Artikel 11).](blog/own-art/c4-before.webp)

![Nachher: dieselbe Stelle nach diesem Meilenstein – eigene Burg, eigene Gebäude, eigene Figuren und Bäume.](blog/own-art/c4-after.webp)

## Eine Pipeline statt Handarbeit {#pipeline}

Bei über hundert Modellen kann man nicht jedes einzeln von Hand bauen. Stattdessen entsteht eine **Pipeline**: eine
Kette von Skripten, die jedes Modell durch dieselben Schritte schickt. Jeder Schritt liest Dateien des vorigen und
schreibt eigene. Das hat drei Vorteile: Man kann jeden Schritt einzeln wiederholen, man kann ihn verbessern und alle
Modelle neu durchlaufen lassen, und man sieht genau, wo ein Fehler entstanden ist.

![Eine Figur von der Idee bis ins Spiel. Blau sind die bezahlten Schritte bei Meshy, Orange die eigenen Skripte.](blog/own-art/pipeline-de.svg)

Die Schritte:

1. **Konzept** mit einem Bildmodell. Für Figuren ein Bogen mit vier Ansichten (siehe
   [Artikel 10](blog/characters-coding/)), für Gebäude eine Vorderansicht und bei Bedarf eine Rückansicht.
2. **Bild → 3D** bei Meshy 7.1: etwa vier Minuten, 30 Credits.
3. **Auto-Rig:** Meshy setzt ein Skelett ein (5 Credits). Gebäude brauchen keins.
4. **Bewegungen:** je Clip 3 Credits – Laufen, Arbeiten, Kämpfen, Sterben.
5. **Remesh:** dasselbe Modell auf rund 2 000 Dreiecke reduziert, als Spielmodell für die Ferne (5 Credits).
6. **Nachbearbeitung** mit eigenen Skripten: Teamfarbe, Lücken in der Textur füllen, Waffen starr binden,
   Detailstufen, Bewegungsdateien kürzen.

In der Weboberfläche von Meshy lässt sich jeder dieser Zwischenstände ansehen: das rohe Modell, das eingesetzte
Skelett, jede Bewegung. Das Skript braucht sie nicht, es arbeitet über die Programmierschnittstelle von Meshy – aber
zum Verstehen, was dort passiert, ist der Blick hinein hilfreich.

1 500 Meshy-Credits kosten etwa 20 Dollar. Eine Figur mit sechs Bewegungen kostet so rund 58 Credits, also knapp einen
Dollar; ein Gebäudekonzept mit Seedream 5.0 Flash zwei Cent.

### Die Auftragsdatei

Jeder bezahlte Schritt wird vorher in einem Budget-Buch (`assets-src/credits.json`) gebucht und bricht über der
Grenze ab. Und jede Auftragsnummer von Meshy landet sofort in einer Datei `job.json` neben dem Modell. Bricht ein Lauf
ab – Netz weg, Guthaben leer –, liest das Skript beim nächsten Start die Auftragsdatei und macht beim nächsten offenen
Schritt weiter, statt bereits Bezahltes noch einmal zu bestellen. Diese Eigenschaft nennt man
[Idempotenz](https://de.wikipedia.org/wiki/Idempotenz): Ein Skript zweimal laufen zu lassen, hat dieselbe Wirkung wie
einmal.

## Gebäude: alle Stufen in einem Bild {#buildings}

Ein Gebäude hat bis zu drei Ausbaustufen. Erzeugt man jede einzeln, sieht jede ein bisschen anders aus: anderer
Maßstab, andere Bauweise, andere Dachfarbe. Die Idee des Projektinhabers: **alle Stufen in einem Bild** bestellen,
nebeneinander. Dann malt das Bildmodell sie im selben Stil und Maßstab. Dazu feste Regeln, die für alle Gebäude
gelten:

- einheitliche Terrakotta-Dächer (Blau ist Spielerfarbe und darf nicht aufs Dach),
- je Stufe ein Geschoss mehr und wertigeres Material: Holz und Putz, dann Steinsockel, dann behauener Stein mit
  goldenen Spitzen,
- freigestellt, ohne Boden und ohne Rauch (Rauch würde Meshy zu Geometrie machen), nur eine Tür, keine Schrift,
- ein Wimpel in Magenta, den das Spiel später in die Spielerfarbe umfärbt.

Der Stil kommt aus Referenzbildern, nicht aus Worten: Zum Prompt gehören das Symbol des Gebäudes aus dem Spiel und ein
„Stilhaus“, das der Projektinhaber selbst mit einem Bildmodell erzeugt hatte. Nach einem Vergleich mehrerer Modelle
wurde Seedream 5.0 Flash (zwei Cent je Bild) der Standard für Gebäude.

![Der Schaukasten: eine Sonderkarte, auf der jedes Modell einmal steht – hier ein Ausschnitt mit Burg, Wohnhäusern und Werkstätten in verschiedenen Ausbaustufen.](blog/own-art/showcase.webp)

## Nachbearbeitung: drei Probleme, drei Skripte {#postprocess}

### Helle Linien in der Ferne: Lücken füllen

Meshys Texturen bestehen aus Hunderten kleiner Inseln: Jedes Stück der Oberfläche ist irgendwo auf dem Texturbild
ausgebreitet, dazwischen ist leerer Hintergrund. Aus der Nähe stört das nicht, denn kein Dreieck zeigt auf den
Hintergrund. Aus der Ferne schon.

Der Grund heißt [Mipmapping](https://de.wikipedia.org/wiki/Mip-Mapping). Ist ein Objekt klein auf dem Bildschirm,
nimmt die Grafikkarte nicht das volle Texturbild, sondern eine vorab verkleinerte Fassung (halb so groß, ein Viertel
so groß …). Beim Verkleinern werden Nachbarpixel gemittelt – und am Rand einer Insel mischt sich dabei die Farbe des
leeren Hintergrunds hinein. Im Spiel erscheinen dann helle Linien entlang der Nähte.

Die Lösung: Die Lücken zwischen den Inseln werden vollständig mit der Farbe der nächstgelegenen Insel gefüllt. Dann
mischt sich beim Verkleinern nur noch „richtige“ Farbe dazu.

### Das Schwert, das sich biegt

Werkzeuge in der Hand waren das schwierigste Thema des ganzen Zweigs. Meshy weiß nicht, dass ein Schwert starr ist.
Es verteilt die Ecken der Klinge auf mehrere Knochen – Hand, Unterarm, manchmal sogar das Knie. Bewegt sich die Figur,
biegt sich die Klinge wie Gummi.

Das Skript `rigid.mjs` repariert das geometrisch: Alle Ecken, die in einem Zylinder von der Hand bis zur Klingenspitze
liegen, werden zu 100 % an den Handknochen gebunden.

```js
// scripts/asset-gen/rigid.mjs (gekürzt)
export function bindCylinder(pos, joints, weights, a, b, radius, joint, start = 0.08) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  for (let i = 0; i < pos.length / 3; i++) {
    const v = [pos[i * 3] - a[0], pos[i * 3 + 1] - a[1], pos[i * 3 + 2] - a[2]];
    const t = (v[0] * ab[0] + v[1] * ab[1] + v[2] * ab[2]) / L2;       // Lage entlang der Achse
    if (t < start || t > 1.03) continue;
    const d2 = (v[0] - ab[0] * t) ** 2 + (v[1] - ab[1] * t) ** 2 + (v[2] - ab[2] * t) ** 2;
    if (d2 > radius * radius) continue;                                  // zu weit von der Achse
    // nur noch ein Knochen mit Gewicht 1
    for (let k = 0; k < 4; k++) { joints[i * 4 + k] = k === 0 ? joint : 0; weights[i * 4 + k] = k === 0 ? 1 : 0; }
  }
}
```

Das ist Vektorrechnung aus der Oberstufe: `t` ist die [Projektion](https://de.wikipedia.org/wiki/Orthogonalprojektion)
der Ecke auf die Gerade von der Hand (`a`) zur Spitze (`b`), als Bruchteil der Strecke. `d2` ist das Quadrat des
Abstands von der Geraden. Liegt `t` zwischen knapp über 0 und 1 und ist der Abstand kleiner als der Radius, liegt die
Ecke im Zylinder. Verglichen wird mit Quadraten, damit keine Wurzel nötig ist. Die Faust selbst (`t` unter 0,08) bleibt
so gewichtet, wie Meshy sie hatte, damit die Finger sich weiter bewegen.

### 1 470 MB Bewegungsdateien

Für jeden Clip liefert Meshy eine eigene Datei – und in jeder steckt das **komplette Modell** samt Textur, 4 bis 8 MB.
Gebraucht werden aber nur die Bewegungsspuren: für jeden Knochen eine Liste von Zeitpunkten und Drehungen. Bei Dutzenden
Figuren mit je sechs bis zehn Clips kamen so 1 470 MB zusammen.

![Was in einer Bewegungsdatei steckt und was davon gebraucht wird.](blog/own-art/animation-file-de.svg)

Das Skript `strip-anims.mjs` öffnet jede Datei mit der Bibliothek glTF-Transform, wirft Netz, Skin, Material und
Textur weg und behält nur Spuren und Knochennamen – 20 bis 50 KB je Clip. Danach sind es 16 MB. „Verlustfrei“ ist hier
wörtlich gemeint: Das fertige Spielmodell, das die Nachbearbeitung aus den gekürzten Dateien baut, ist Bit für Bit
gleich.

Das Dateiformat dahinter heißt [glTF](https://de.wikipedia.org/wiki/GlTF) (in der binären Form `.glb`): ein offenes
Format für 3D-Szenen, das Netze, Materialien, Skelette und Animationen in einer Datei speichert – gewissermaßen das
JPEG für 3D.

## Was nicht klappte {#problems}

- **Werkzeuge in der Hand sahen „miserabel“ aus** (Urteil des Projektinhabers). Generierte Bewegungen kennen kein
  Werkzeug: Die Hände sind offen, das Werkzeug schwebt. Mit der Waffe im Konzept und dem Arm nah am Körper verschmolz
  Meshy das Schwert mit dem Bein. In der A-Pose ließ es Gehaltenes ganz weg. Lösung für Soldaten: Waffe fest im
  Modell, vom Körper weg, Haltung des Konzepts behalten, Klinge per Skript starr an den Handknochen.
- **Das Meshy-Guthaben war leer:** Der erste Durchlauf schaffte 36 Gebäudestufen, 12 Figuren und das Pferd, dann brach
  er ab. Seitdem steht jeder Schritt in der Auftragsdatei und wird fortgesetzt statt neu bezahlt.
- **Bildmodelle** malten deutsche Gebäudenamen als Schrift ins Bild, ignorierten Zahlen wie „1,5 × Breite“ (eine
  anschauliche Beschreibung wie „drei Fensterreihen übereinander“ wirkt) und machten Gruben zu ausgeschnittenen
  Erdwürfeln – „flach wie ein Teppich“ half.
- **Der Händler mit Waage** verlor im Rig zweimal den Kopf. Er trägt jetzt keine Waage.

## Zum Nachmachen {#tips}

- Bau eine Pipeline aus kleinen Schritten mit Dateien dazwischen – dann lässt sich jeder Schritt einzeln wiederholen.
- Schreib Auftragsnummern sofort weg und mach Skripte idempotent. Bezahlte Schritte bestellt man nur einmal.
- Stil kommt aus Referenzbildern, nicht aus Worten – und gib nie eigene Zwischenergebnisse als Stilvorlage weiter,
  Fehler vererben sich.
- Erzeuge zusammengehörige Dinge in einem Bild (alle Stufen eines Gebäudes).
- Prüfe Modelle in Spielgröße und aus der Ferne: Fehler wie helle Nähte sieht man nur dort.
