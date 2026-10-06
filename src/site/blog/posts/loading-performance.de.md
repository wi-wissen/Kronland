---
title: Laden, Caching und Figuren-Feinschliff
date: 2026-10-06T09:11:03+02:00
teaser: Inhalts-Hash für jede Datei, Nahmodelle erst beim Heranzoomen: Ein freies Spiel lädt 19 statt 35 MB. Dazu Angriffswarnung und gleich große Figuren.
milestone: true
---

## Was entstand {#what}

- **Laden und Caching:** Jede Datei aus `public/` bekommt im Build einen Inhalts-Hash im Namen und darf für immer
  im Cache liegen; ein Ladebericht misst, was jedes Szenario wirklich lädt; Sonderkarten mit Belastungsprobe; ein Werkzeug
  für die Rohdateien der Pipeline, die nicht mehr ins Git gehören.
- **Figuren:** Animationen liegen im Spielmodell, das Nahmodell lädt erst beim Heranzoomen.
- **Bedrohung erkennen:** Sturmglocke, vertonte Hilferufe und ein roter Puls auf der Minikarte; Leibeigene fliehen
  bei Angriff oder greifen an wie beim Holzhacken.
- alle Figuren gleich groß, Beine laufen im Tempo der Bewegung, feste Plätze an Baustelle, Baum und Lagerfeuer,
  ruhigerer Ton; ein robusterer Dialog-Test am Handy.

## Wie {#how}

- Erst messen: `scripts/load-report.mjs` öffnet jedes Szenario dreimal (leer, mit Service-Worker, aus dem Cache) und zählt jede Antwort.
- Regel für alle Sitzungen: Jede Adresse einer Datei aus `public/` geht durch `siteUrl()`/`assetUrl()` – nur so findet der Build die gehashte Datei.

## Was nicht klappte {#problems}

- Die Hälfte der Startdaten waren Nahmodelle der Figuren (~2,4 MB je Figur), nur weil sie Skelett und Animationen
  enthielten. Nach dem Umbau: freies Spiel 35 → 19 MB, Handy 19 → 14,5 MB, beim zweiten Besuch nichts aus dem Netz.
- Wer eine Datei direkt mit `fetch('../models/x.glb')` lädt, bekommt im Build einen 404 – deshalb die Regel oben und ein E2E-Muster `hashed()`.
- Vergrößerte Helden und Hauptleute wirkten falsch; jetzt misst das Spiel die Ruhehaltung und macht alle gleich groß.
- Ein E2E-Test zur Angriffswarnung scheiterte, weil die Gegner-KI die Testfigur wegschickte – sie wird jetzt direkt vor dem Klick platziert.

## Zum Nachmachen {#tips}

- Messen vor optimieren: Ein Ladebericht je Szenario zeigt sofort, wo die Megabytes stecken.
- Inhalts-Hash plus „CacheFirst“ im Service-Worker: einmal laden, nie wieder fragen.
- Rohdateien der Asset-Pipeline früh aus dem Git halten, sonst wächst das Repository mit jedem Durchlauf.
