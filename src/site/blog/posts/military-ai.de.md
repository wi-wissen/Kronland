---
title: Militär und Computergegner
date: 2026-10-03T12:35:21+02:00
teaser: Kampf, Türme, Helden und Wetter – und ein Computergegner, der über dieselben Befehle spielt wie der Mensch.
milestone: true
---

## Was entstand {#what}

Zwei Schritte in vier Minuten: zuerst Militär (Kampf, Türme, Helden, Miliz, Wetter, Sieg und Niederlage), dann ein
Computergegner, der aufbaut, forscht, ein Heer aufstellt, angreift und sich verteidigt.

## Wie {#how}

- Die KI ist ein Spieler wie jeder andere: Sie liest den Zustand und schickt Befehle in die Simulation. Damit bleibt
  alles deterministisch, und KI-Partien lassen sich ohne Grafik in Node abspielen (`scripts/ai-match.js`).
- Wetter ist Teil der Regeln: Im Winter frieren Flüsse zu und werden zu Wegen.

## Was nicht klappte {#problems}

Die KI war anfangs zu gutgläubig. Die QA-Runde fand am nächsten Morgen, dass sie Leibeigene und Truppen immer wieder zu
unerreichbaren Zielen schickte – bis zu 1 724 vergebliche Wegsuchen in 150 Sekunden, Ruckler über eine Sekunde. Die
Lösung kam aus der Simulation: Gebietsnummern zeigen sofort, ob ein Ziel erreichbar ist, und die KI plant nur noch
erreichbare Bauplätze und Ziele (danach: null Fehlversuche in denselben Partien).

## Zum Nachmachen {#tips}

- Lass die KI über die öffentliche Befehlsschnittstelle spielen, nie mit Sonderrechten – dann ist sie auch fair.
- KI gegen KI ohne Grafik ist der beste Dauertest für Simulation und Leistung.
