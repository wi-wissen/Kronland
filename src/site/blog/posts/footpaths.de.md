---
title: Trampelpfade – eine Kachel, ein Byte, ein Weg
date: 2026-10-09T17:30:00+02:00
teaser: Wo Leibeigene oft laufen, wird das Gras flach und dann zu Erde; im Schnee bleiben Fußabdrücke. Wie die Simulation das mit einem Byte je Kachel rechnet, warum der Weg trotzdem nicht wie ein Schachbrett aussieht – und warum ein kleiner Prüfstand mehr half als zwanzig Stadtbilder.
---

## Worum es geht {#what}

Ein Aufbauspiel lebt davon, dass man der Siedlung ansieht, was in ihr passiert. Seit diesem Stand treten die Figuren
Wege aus: Wer oft zwischen Burg und Lager läuft, legt erst das Gras flach, dann eine Erdspur frei. Im Winter hinterlässt
jeder Schritt Fußabdrücke, viele Schritte eine festgetretene Spur. In den Einstellungen gibt es dafür drei Stufen:
**aus**, **verblassend** (Standard) und **dauerhaft**.

Der Artikel erzählt zwei Dinge: wie die Pfade in der Simulation entstehen – und wie lange es dauerte, bis sie auch
gut aussahen.

## Ein Byte je Kachel {#field}

Die Simulation von Kronland rechnet nur mit Ganzzahlen und muss auf jedem Rechner dasselbe Ergebnis liefern (sonst
funktioniert später kein Mehrspieler im Gleichschritt). Die Pfade sind deshalb schlicht ein Feld mit **einem Byte je
Kachel**, Stärke 0 bis 255:

- **Wachsen:** Verlässt eine Figur eine Kachel, wird die Spur dort stärker – erst schnell, dann immer langsamer
  (`gain · (255 − Stärke) / 255`). Nur häufig begangene Kacheln werden zu Pfaden.
- **Im Verhältnis zur Siedlung:** Der Zuwachs richtet sich nach der Zahl der Läufer des Spielers, `√(20 / Läufer)`,
  begrenzt auf 35 … 200 %. Ein Dorf mit acht Leibeigenen sieht schon nach wenigen Gängen kleine Pfade, eine Stadt mit
  150 Figuren tritt nur ihre Hauptwege aus.
- **Verblassen:** Ein „Besen“ besucht jede Kachel alle zehn Sekunden und nimmt etwas weg – im Schnee mehr als im Gras,
  auf blanker Erde weniger. Seine Position folgt aus dem Takt, es gibt keine Liste und nichts zu speichern außer den
  Bytes selbst.
- **Jahreszeiten:** Neuschnee deckt die Sommerpfade zu, Tauwetter nimmt die Schneespuren mit. In der Stufe
  „dauerhaft“ bleibt alles liegen.

Die Einstellung ist eine Spieloption der Simulation: Sie steht im Spielstand und im Prüfwert, und eine Änderung mitten
im Spiel ist ein gewöhnlicher Befehl. Ein Level, das eine Spur braucht – etwa die Fährte im Schnee der Kursmission
„Im Schneetreiben“ –, legt den Modus selbst fest. Skripte können mit `nelia.front() == "track"` nach einer Spur
schauen; die Schwelle dafür ist dieselbe, ab der man sie im Bild deutlich sieht.

## Pro Kachel gerechnet, aber kein Schachbrett {#organic}

Ein Byte je Kachel heißt: Die Simulation kennt nur Quadrate. Die erste Fassung zeigte das auch – Wege aus Kacheln,
Ecken im rechten Winkel, Diagonalen als Treppe. Das Gelände selbst hat aber kein sichtbares Raster, und so sahen die
Pfade aus wie auf ein Schachbrett gemalt.

Die Lösung liegt ganz in der Darstellung. Beim Befüllen der Datentextur bekommt jede Kachel drei Werte:

- die **Stufe** des Weges (wie stark er ausgetreten ist),
- dieselbe **über die Nachbarn geglättet** – entlang der Linie, so dass eine Diagonale aus Kacheln, die sich nur an
  der Ecke berühren, so stark ist wie ein gerader Weg,
- die **Laufrichtung**, aus dem Gefälle des Feldes (als doppelter Winkel, damit hin und zurück dieselbe Richtung ist).

Der Geländeshader liest das geglättete Feld **bikubisch**, verschiebt den Zugriff mit ruhigem Rauschen um bis zu eine
halbe Kachel (der Weg schlängelt sich) und schneidet den Weg an einer Schwelle aus. So entstehen Kurven statt Ecken
und Diagonalen statt Treppen, obwohl darunter weiter Kacheln liegen.

## Gras und Schnee {#materials}

Im Winter malt der Shader Fußabdrücke als ovale Paare in Laufrichtung, nah an der Mitte des Weges. Mit wachsender
Stärke kommen weitere Lagen dazu, jede ein wenig gedreht und versetzt, bis sie zu einer festgetretenen, leicht
schmutzigen Spur verschmelzen.

Im Sommer gilt **dieselbe Geometrie** – nur das Material wechselt: schwach getreten liegen hellere Halme flach, mittel
zeigt sich eine dünne Erdlinie in der Mitte, voll ausgetreten ein schmaler Erdweg mit weichem Grasrand.

![Der Prüfstand: fünf Formen (gerade, diagonal, Knick, S-Kurve, Abzweig) in drei Stärken, links Sommer, rechts Winter – immer ein Weg, im Sommer wie im Schnee gleich breit.](blog/footpaths/bench.webp)

## Wie es dahin kam {#story}

Der Weg zu diesem Bild führte über mehrere Fehlversuche:

1. **Schachbrett:** Pfade aus Kacheln, siehe oben.
2. **Zu breit:** Mit Glättung und Rauschen wurden die Wege rund – aber im Sommer viel breiter als der Schnee. Breite
   braune Flächen ließen die Siedlung unordentlich aussehen.
3. **Parallele Streifen:** Ein Versuch, jede Pfadkachel als kurze Kapsel in Laufrichtung zu zeichnen, machte die
   einzelnen Wege schmal. In der Stadt lagen dann aber mehrere Streifen nebeneinander, wo eigentlich ein Weg war.

Das eigentliche Problem war die Prüfung. Stadtbilder nach zwanzig Minuten Spiel sind schön, aber für diese Frage
nutzlos: Gebäude, Bäume und viele Figuren überdecken alles, jeder Lauf sieht anders aus, und man kann nicht sagen, ob
ein Weg zu breit ist oder ob dort einfach drei Wege nebeneinander liegen.

Also ein **Prüfstand**: eine flache, leere Karte, auf der das Spurfeld direkt gesetzt wird – gerade, diagonal, ein
Knick, eine S-Kurve, ein Abzweig, jeweils schwach, mittel und voll. Jede Zelle bekommt dieselbe Kamera, Sommer neben
Winter. Ein Test prüft dazu, dass jede Form im geglätteten Feld genau **ein** zusammenhängender Weg ist. Mit diesem
Bogen ließen sich Breite und Form in Minuten vergleichen statt in Stunden – und die Antwort war klar: Der Schnee war
richtig, der Sommer musste dieselbe Form bekommen.

![Dieselbe KI-Stadt dreimal: links zu breite, fleckige Erdflächen, in der Mitte Streifen nebeneinander, rechts heute – je Route ein zusammenhängender Weg, breit dort, wo Gruppen nebeneinander laufen. Für die Frage „wie breit ist ein Weg?“ taugen solche Bilder kaum; dafür gibt es den Prüfstand.](blog/footpaths/iterations.webp)

## Breite Bänder an belebten Stellen {#bands}

Ein Fall gehört ausdrücklich dazu: Schickt man eine Gruppe Leibeigener los, bekommt jeder sein eigenes Zielfeld, und
sie laufen nebeneinander. Das Feld wird an solchen Stellen zwei bis drei Kacheln breit. Im Bild ist das trotzdem ein
Weg, nur ein breiterer – wie ein Platz vor der Burg, über den alle laufen. Das ist gewollt: Belebte Stellen nutzen
sich stärker ab.

![Vier Leibeigene laufen einen Weg mit Knick hin und her: im Sommer ein Erdband, im Winter dieselbe Form im Schnee.](blog/footpaths/walked.webp)

## Was es kostet {#cost}

- **Simulation:** eine Schleife über die Figuren je Takt (die gab es schon) plus der Besen mit Kacheln/100 je Takt –
  auf einer Karte mit 256 × 256 Kacheln rund 650 Bytes.
- **Textur:** höchstens alle halbe Sekunde neu befüllt, nur Zeilen in der Nähe von Spuren; im ungünstigsten Fall
  etwa 8 ms auf einer 256er-Karte voller Wege.
- **Shader:** vier Texturzugriffe für den bikubischen Wert, die Fußabdrücke nur im Winter. Die niedrige Grafikstufe
  nimmt einen einzigen linearen Zugriff.

![Eine KI-Stadt nach zwanzig Minuten im Sommer: Die Hauptwege sind ausgetreten, wo viele Figuren nebeneinander laufen, zu breiten Bändern.](blog/footpaths/town.webp)

## Zum Nachmachen {#tips}

- Rechne in der Simulation so einfach wie möglich (ein Byte je Kachel) und mach das Bild in der Darstellung schön.
- Baue für eine Optikfrage einen Prüfstand mit sauberen Fällen, bevor du an Spielbildern schraubst.
- Prüfe Sommer und Winter mit derselben Form; nur das Material darf sich unterscheiden.
- Ein kleiner Test („genau ein Weg je Form“) verhindert, dass ein Rückfall unbemerkt bleibt.
