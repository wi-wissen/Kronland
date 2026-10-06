---
title: Stimmen, Musik und Einführungsmission
date: 2026-10-05T15:03:47+02:00
teaser: 368 Sprachaufnahmen mit automatischer Hörprüfung, zwölf Musikstücke von Lyria 3, CC0-Geräusche – und viele kleine Verbesserungen an einem Tag.
milestone: true
---

## Was entstand {#what}

- **Stimmen:** Jeder Sprecher der Missionen und jede Figurenrolle bekommt eine Stimme; alle Dialoge und Sprüche
  sind auf Deutsch und Englisch vertont, zusammen 368 Aufnahmen.
- **Musik:** zwölf Stücke mit Google Lyria 3 Pro – Aufbau, Winter, Kampf, Menü, Sieg und Niederlage – mit Pausen
  zwischen den Friedensstücken; Arbeitsgeräusche aus CC0-Aufnahmen von Kenney, der Amboss von Freesound.
- **Viele kleine Verbesserungen:** Minikarte schickt Figuren, Helden übereinander, klares Eis, Dialoge ohne
  Hineinsprechen, Sprüche seltener – und Mission 1 wird zur geführten Einführung.

## Wie {#how}

- Stimmen: Rolle beschreiben (Alter, Stimmfarbe, Haltung) → Entwurf mit Seed Audio → Klon für alle Sätze → ein zweites
  Modell (Gemini) hört nach, ob der Wortlaut stimmt und nur die Stimme zu hören ist → ein Mensch wählt auf einer Hörseite.
- Musik: Prompts mit Instrumenten, Tempo, Tonart und Form; Gemini prüft auf Gesang und Brüche, der Nutzer entscheidet nach Gehör.
- Lautheit nach Norm: Stimmen −18 LUFS, Musik −22 (Frieden) bzw. −20 LUFS (Kampf).

## Was nicht klappte {#problems}

- Lyria liefert keine kurzen Stücke (auch „10 seconds“ ergibt rund 60 s) und mischt wie Popmusik (≈ −11 LUFS). Etwa jeder
  fünfte Entwurf hatte trotz Verbot Gesang, etwa jede dritte Anfrage kam zufällig mit `403 PROHIBITED_CONTENT` zurück –
  das Skript überspringt Vorhandenes, also einfach erneut aufrufen. „Im Stil von …“ half nicht.
- Seed Audio vertonte bildhafte Wörter als Kulisse (Pferde, Tor), Auslassungspunkte führten zu Abbrüchen, der Prüfer hörte
  englisches „Aye“ als „Hi“. Lösung: neutrale Vorlagensätze, Kommas statt Pünktchen, der Prüfer erfährt die Sprache.
- Der Kenney-Amboss klang zu dumpf – ein CC0-Amboss von Freesound ersetzte ihn. Sprüche kamen zu oft und überlagerten sich.

## Zum Nachmachen {#tips}

- KI-Prüfer filtern Offensichtliches vor (Gesang, falscher Wortlaut); den Geschmack entscheidet ein Mensch.
- Mach Erzeugungsskripte wiederaufnehmbar – Modelle lehnen zufällig ab, Netzverbindungen brechen ab.
- Bring alle Aufnahmen auf eine Lautheit, bevor du sie im Spiel beurteilst.
