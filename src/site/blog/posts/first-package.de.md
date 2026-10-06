---
title: Startmenü, Speichern, PWA und CC0-Modelle
date: 2026-10-03T12:48:26+02:00
teaser: Mit freien KayKit-Modellen, Startmenü, Spielständen, PWA und CI ist Kronland eine Stunde nach dem ersten Commit zum ersten Mal ganz spielbar.
milestone: true
---

## Was entstand {#what}

Der Schritt mit den meisten Dateien des ersten Tages (116): CC0-Modelle aus dem KayKit Medieval Hexagon Pack von
Kay Lousberg, ein Startmenü, Speichern und Laden, Offline-Fähigkeit als Progressive Web App und eine CI-Pipeline, die
bei jedem Push Vitest und Playwright laufen lässt. Drei Minuten später wird die Dateiendung der Modelle einstellbar.

## Wie {#how}

- Freie Platzhaltermodelle statt eigener Grafik: Das Spiel sah sofort nach etwas aus, und die Darstellung konnte gegen
  echte Modelle entwickelt werden.
- GitHub Actions führt `npm test` und die E2E-Tests aus; bei Fehlern werden die Playwright-Ergebnisse angehängt.

## Was nicht klappte {#problems}

Manche Webhoster liefern `.glb`-Dateien nicht aus. Lösung: `window.KRONLAND_MODEL_EXT` erlaubt eine andere Endung
(z. B. `.json`). Die KayKit-Modelle selbst blieben nur zwei Tage – am 5. Oktober ersetzte eigene Grafik sie fast
vollständig; geblieben sind Baugerüst, Bauphasen, Trümmer und Felsen.

## Zum Nachmachen {#tips}

- Mit CC0-Paketen früh spielbar werden, eigene Grafik später. Die Lizenz (CC0) erspart jede Rechtsfrage.
- CI am ersten Tag einrichten: Agenten verlassen sich auf grüne Tests, und die CI sieht, was eine Sitzung vergessen hat.
