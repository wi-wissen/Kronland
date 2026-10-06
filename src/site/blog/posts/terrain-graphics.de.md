---
title: Gelände und Grafik
date: 2026-10-03T19:45:30+02:00
teaser: Gebirge, Flüsse mit Furten, Klippen, Wasser-Shader und Himmel – und eine eigene Runde, damit das alles auch auf schwachen Geräten läuft.
milestone: true
---

## Was entstand {#what}

Am Nachmittag des 3. Oktober wird aus dem Prototyp eine Landschaft. Der Kartengenerator erzeugt Relief mit Gebirgen,
einen Fluss, der den Tälern folgt, Furten, Klippen, einen Erzberg je Spieler und drei Kartengrößen (96, 128, 160).
Die Grafik bekommt Grafikstufen, texturiertes Gelände, einen Wasser-Shader, Himmel, Bäume und Deko.

## Wie {#how}

- Kartengenerator: fBm-Rauschen mit Gebietsverzerrung, Grat-Rauschen für Gebirgsmassive, der Fluss per Dijkstra durch
  die Täler. Verbindungen zwischen allen Starts, Schächten und Plätzen werden erzwungen – und getestet.
- Grafikstufen niedrig/mittel/hoch, automatisch gewählt oder per `?quality=`; Gelände mit Splat-Shader und
  dreiseitig projiziertem Fels an Klippen.

## Was nicht klappte {#problems}

Auf schwachen Geräten und unter Software-Grafik startete das Spiel zäh. Ein eigener Arbeitsschritt („Leistung auf schwachen
Geräten“) erkennt eine Software-GPU und wählt dann die niedrige Stufe mit halber Auflösung, ohne Schatten und mit wenig
Deko; Bäume und Deko werden beim ersten Bild aufgebaut und die Shader vorgewärmt, alle Naturmaterialien teilen sich ein
Shader-Programm. Und die Felsgipfel waren zu häufig – ein kleiner Nachtrag machte sie seltener.

## Zum Nachmachen {#tips}

- Erzwinge und teste spielwichtige Eigenschaften der Zufallskarte (Erreichbarkeit, Holz am Start) statt auf Glück zu hoffen.
- Prüfe Grafik früh auf dem schwächsten Ziel. Eine automatische Grafikstufe ist billiger als Beschwerden.
