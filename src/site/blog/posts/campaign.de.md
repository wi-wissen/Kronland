---
title: Kampagne „Krone aus Eis“ und gemalte Welt
date: 2026-10-04T23:17:24+02:00
teaser: Sechs Missionen „Krone aus Eis“ mit neuen Helden, Diplomatie und Tributen – und der Mut, eine halbe Erweiterung wieder zu streichen.
milestone: true
---

## Was entstand {#what}

- **Kampagne:** Die Leibeigenentochter Nelia sammelt mit dem Händler Orrin die Zacken einer zerbrochenen Krone.
  Neu sind mehrere Helden je Spieler, Diplomatie, Gesprächsfiguren und Tribute (kaufen oder kämpfen), sechs Missionen.
- **Gemalte Welt:** sechs nahtlose Bodentexturen aus der Bild-KI, Favicon und App-Symbole aus der gemalten Krone
 , Bäume mit Detailstufen nach Bildschirmhöhe, modernisierte Lernabenteuer.

## Wie {#how}

- Zuerst eine Konzeptnotiz, die die Geschichte mit den Mechaniken des Vorbilds abgleicht, dann Konzeptbögen der Helden
  (`openai/gpt-5.4-image-2`), dann die Missionen – und danach wieder die Missionsmatrix des Bots.
- Bodentexturen: je Art mehrere Kandidaten, auf einem Übersichtsbogen 2 × 2 gekachelt verglichen, dann nahtlos gemacht
  und auf die Farbwelt des Spiels geschoben (`scripts/asset-gen/ground.mjs`).

## Was nicht klappte {#problems}

- **Zu viel Inhalt:** Wirtshaus, Dieb, Kundschafter und Büchsenschützen aus der Erweiterung passten nicht zur Kampagne.
  Sie wurden wieder entfernt – nur Brücken, Brunnen und Denkmal blieben. Der Meilenstein löscht deshalb über 4 000 Zeilen.
- Mission 3 wurde nach dem ersten Wurf neu gebaut (Tal, Tor oder Schlucht, Tauwetter).
- Bodentexturen mit einzelnen auffälligen Formen wiederholen sich sichtbar; gut sind gleichmäßige Bilder ohne dunklen Rand.

## Zum Nachmachen {#tips}

- Schnell gebaut heißt nicht, dass es bleiben muss: Streichen ist mit Agenten billig, Pflegen nicht.
- Kachel Texturkandidaten, bevor du wählst – Wiederholung sieht man nur im Verbund.
- Erst die Geschichte gegen die Mechanik prüfen, dann Missionen schreiben.
