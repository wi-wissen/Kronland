---
title: Stimmen, Musik und Einführungsmission
date: 2026-10-05T15:03:47+02:00
teaser: 368 Sprachaufnahmen, die ein zweites KI-Modell automatisch nachhört, zwölf Musikstücke von Lyria 3 und Geräusche aus freien Aufnahmen. Was Lautheit ist, wie man Wortlaut misst und warum der Ton nie den Spielablauf bestimmen darf.
milestone: true
---

## Worum es geht {#what}

Bis hierher war Kronland fast stumm, oder genauer: Alle Klänge wurden zur Laufzeit synthetisch erzeugt, mit der
Web Audio API aus Rauschen, Hüllkurven und simulierten Saiten (siehe [Artikel 7](blog/parallel-branches/)). In diesem
Meilenstein bekommt das Spiel echte Stimmen und Musik:

- **Stimmen:** Jeder Sprecher der Missionen und jede Figurenrolle bekommt eine Stimme. Alle Dialoge und kurzen
  Sprüche beim Auswählen und bei Befehlen sind auf Deutsch und Englisch vertont, zusammen 368 Aufnahmen.
- **Musik:** zwölf Stücke von Google Lyria 3 Pro – fünf für den Aufbau, zwei für den Winter, zwei für den Kampf,
  dazu Menü, Sieg und Niederlage.
- **Geräusche:** Holzhacken, Spitzhacke, Hammer, Klingen und Münzen aus freien Aufnahmen (CC0) von Kenney, der Amboss
  von Freesound.
- **Viele kleine Verbesserungen:** Die Minikarte schickt Figuren, Dialoge sprechen nicht mehr ineinander, Sprüche
  kommen seltener – und Mission 1 wird zur geführten Einführung.

Die Erzeugung ist hier nicht der schwierige Teil. Schwierig ist, aus Hunderten Ergebnissen die brauchbaren
herauszufinden, ohne alles selbst anzuhören. Darum geht es in diesem Artikel.

![Mission 1 als geführte Einführung: Ein Ausrufezeichen markiert den Fremden auf dem Dorfplatz, das Ziel links oben sagt, was zu tun ist, und Nelia spricht ihren ersten Satz – jetzt mit Stimme.](blog/voices-music/c1-intro.webp)

## Stimmen: vom Steckbrief zur Aufnahme {#voices}

### Rollen und Steckbriefe

Zuerst wird festgelegt, wer überhaupt spricht: alle Missionssprecher (Nelia, Orrin, Malvor, Dorfälteste …) und die
Figurenrollen Leibeigener, Leibeigene, Schwertkämpfer, Soldatin und Kanonier. Speerträger und Reiter teilen sich die
Stimme des Schwertkämpfers. Welche Figur welche Stimme hat, steht im Figuren-Manifest – derselben Datei, aus der auch
die Darstellung liest, welches Modell eine Figur trägt. So passen Aussehen und Stimme immer zusammen.

Jede Rolle bekommt zwei bis drei kurze Beschreibungen, etwa „mächtiger Fürst, etwa fünfundfünfzig, rauer Bass,
langsam und drohend“.

### Entwurf, Auswahl, Klonen

Das Sprachmodell Seed Audio (ByteDance) kann eine Stimme aus einer Beschreibung *entwerfen*: Die Beschreibung steht in
eckigen Klammern vor dem Text und wird nicht mitgesprochen. Dazu kommt immer der Zusatz „reine trockene
Sprachaufnahme, nur die Stimme, keine Musik, keine Hintergrundgeräusche“.

Ein Mensch hört die Entwürfe auf einer kleinen Hörseite an und wählt je Rolle einen aus. Dieser Entwurf wird zur
**Vorlage**. Alle weiteren Sätze werden aus der Vorlage *geklont* – das Modell bekommt die Vorlagenaufnahme samt
Wortlaut mit und spricht den neuen Satz mit derselben Stimme. Nur so klingt Nelia in Mission 1 genauso wie in
Mission 6.

![Der Weg einer Aufnahme: Beschreibung, Entwurf, Auswahl durch einen Menschen, dann für jeden Satz Klonen, Lautheit angleichen und automatisch nachhören. Fällt die Prüfung durch, wird bis zu sechsmal neu erzeugt.](blog/voices-music/voice-pipeline-de.svg)

### Ein zweites Modell hört zu

Bei 368 Aufnahmen hört niemand jede einzelne an. Also übernimmt das ein zweites Modell: Gemini bekommt die Aufnahme
und schreibt auf, was es hört. Zusätzlich soll es `[NOISE]` anhängen, wenn außer der Stimme noch Musik oder Geräusche
zu hören sind. Dann vergleicht das Skript den gehörten Text mit dem Soll-Text.

Wie vergleicht man zwei Sätze? Buchstabe für Buchstabe wäre zu streng – „Orin“ statt „Orrin“ ist kein echter Fehler.
Das Skript vergleicht deshalb **Wortfolgen** mit der [Levenshtein-Distanz](https://de.wikipedia.org/wiki/Levenshtein-Distanz):
der kleinsten Zahl von Einfügungen, Löschungen und Ersetzungen, mit der man eine Folge in die andere verwandelt. Die
Bausteine sind hier ganze Wörter, und zwei Wörter gelten als gleich, wenn sie sich höchstens in einem Buchstaben
unterscheiden.

```js scripts/asset-gen/voice.mjs
export function similarity(a, b) {
  const x = words(a), y = words(b);
  if (x.join('') === y.join('')) return 1;          // "Alder Farm" = "Alderfarm"
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1,                      // Wort fehlt
                       d[i][j - 1] + 1,                      // Wort zu viel
                       d[i - 1][j - 1] + (sameWord(x[i - 1], y[j - 1]) ? 0 : 1)); // ersetzt
  }
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}
```

Das ist [dynamische Programmierung](https://de.wikipedia.org/wiki/Dynamische_Programmierung): Die Tabelle `d[i][j]`
enthält den Abstand der ersten *i* Wörter des einen und der ersten *j* Wörter des anderen Satzes, und jede Zelle ergibt
sich aus drei Nachbarzellen. Bestanden hat eine Aufnahme mit einer Ähnlichkeit von mindestens 0,85 und ohne
`[NOISE]`. Sonst wird sie neu erzeugt, bis zu sechsmal. Eine gute ältere Aufnahme wird nur durch einen bestandenen
Versuch ersetzt.

Bei sehr kurzen Sätzen verhört sich der Prüfer leicht – aus englischem „Aye“ wird „I“ oder „Hi“. Für Sätze mit
höchstens drei Wörtern fragt das Skript deshalb gezielt nach: „Wird ‚Aye!‘ klar und vollständig gesprochen? Antworte
nur mit ja oder nein.“

![Eine fertige Aufnahme als Wellenform: zwei Sätze, dazwischen eine Pause. Die Lautheit ist an alle anderen Stimmen angeglichen.](blog/voices-music/wave-de.webp)

### Wie das Spiel die richtige Datei findet

Jede Aufnahme heißt nach ihrer Rolle und einem Hash ihres Textes, etwa `de/nelia-cd8611c9.mp3`. Eine Indexdatei
ordnet den Schlüssel `Stimme|Sprache|Text` der Datei zu:

```json
"nelia|de|Ich bin eine Leibeigene, Orrin. Mein Vater schlägt Holz.": "de/nelia-cd8611c9.mp3",
"nelia|en|I’m a serf, Orrin. My father chops wood.": "en/nelia-434717f9.mp3",
```

Ändert jemand einen Dialogtext, passt der Schlüssel nicht mehr, und das Skript weiß von selbst, welche Sätze neu
vertont werden müssen. Fehlt eine Aufnahme, bleibt der Dialog stumm oder der Browser liest ihn mit seiner eingebauten
Sprachausgabe vor.

Wichtig: **Der Ton bestimmt nie den Spielablauf.** Wie lange ein Dialog dauert, berechnet die Simulation aus der
Textlänge, nicht aus der Länge der Aufnahme. Sonst würde ein Rechner mit Ton anders spielen als einer ohne, und
die Simulation wäre nicht mehr deterministisch (siehe [Artikel 1](blog/simulation-core/)).

## Lautheit: warum −18 nicht leise ist {#loudness}

Wer Aufnahmen aus verschiedenen Quellen mischt, merkt schnell: Die eine ist doppelt so laut wie die andere. Das
Maß dafür heißt **Lautheit** und wird in LUFS gemessen (*Loudness Units relative to Full Scale*, nach der Norm
[EBU R 128](https://de.wikipedia.org/wiki/EBU_R128)). 0 ist das technische Maximum, die Werte sind darum negativ:
−11 LUFS ist lauter als −22 LUFS. Anders als ein einfacher Spitzenpegel berücksichtigt LUFS, wie empfindlich das Ohr für
verschiedene Tonhöhen ist, und mittelt über die ganze Aufnahme.

Kronland bringt alles auf feste Zielwerte. Das Werkzeug [FFmpeg](https://de.wikipedia.org/wiki/FFmpeg) hat dafür einen
eigenen Filter:

```js
export const LOUDNESS = 'loudnorm=I=-18:TP=-1.5:LRA=11';   // Stimmen: −18 LUFS, Spitze −1,5 dB
ffmpeg(['-i', mp3, '-af', LOUDNESS, '-ar', '24000', '-ac', '1', tmp]);
```

![Wo die Zielwerte liegen. Lyria liefert Musik so laut wie Popmusik; im Spiel soll sie im Hintergrund bleiben.](blog/voices-music/loudness-de.svg)

Lyria liefert seine Stücke mit etwa −11 LUFS und Spitzen bis 0 dB – laut abgemischt wie Popmusik im Radio. Für
Hintergrundmusik ist das viel zu laut. Die Friedensmusik kommt deshalb auf −22 LUFS, die Kampfmusik auf −20, die
Stimmen auf −18, damit Sprache sich über Musik und Geräusche legt.

## Musik mit Lyria 3 {#music}

### Prompts wie ein Arrangeur

Lyria 3 Pro erzeugt aus einem Text ein Musikstück von bis zu zweieinhalb Minuten. Ein vager Wunsch („mittelalterliche
Aufbaumusik“) liefert Beliebiges. Gut funktioniert dagegen, was ein Arrangeur aufschreiben würde: Instrumente, Tempo,
Tonart, Stimmung und Form. Ein Prompt aus `scripts/asset-gen/music.mjs`:

```text scripts/asset-gen/music.mjs
Instrumental only, absolutely no vocals, no choir, no spoken words. Background music for a calm
medieval settlement-building strategy game … Mood: sunny morning in a green valley village,
peaceful and hopeful. Warm orchestral folk: soft string ensemble, solo wooden recorder carrying a
singable melody, harp arpeggios, plucked lute ostinato, light frame drum. 92 BPM, D major with
mixolydian colour. Form: [Intro] harp and lute, [A] recorder melody, [B] strings take the melody,
[A'] recorder returns with counter-melody, [Outro] back to intro texture.
```

Die Form `[Intro] [A] [B] [A'] [Outro]` ist eine klassische Liedform: Thema, Kontrast, Wiederkehr. Sie sorgt dafür, dass
das Stück einen Bogen hat und nicht ziellos dahinplätschert. Prompts sind auf Englisch, weil Modelle dort am
zuverlässigsten folgen.

### Vorhören lassen, selbst entscheiden

Auch hier hört zuerst ein Modell: Gemini bewertet jeden Entwurf – Gesang ja/nein, harte Brüche, Instrumente, grobe
Note. Etwa jeder fünfte Entwurf hatte trotz Verbot Gesang oder Chor, das erkennt Gemini zuverlässig. Die Noten dagegen
waren fast immer 1 oder 2 und taugten nicht zur Rangfolge. Die eigentliche Wahl traf der Projektinhaber nach Gehör.

### Musik im Spiel

Die Musik hängt am Spielzustand, nicht am Ort: Frieden, Winter oder Kampf. Zwischen zwei Friedensstücken liegt eine
einstellbare Pause, in der nur die Umgebung klingt – Wind, Vögel, Wasser. Über Stunden nutzt sich Musik sonst ab. Jedes
Stück wird erst geladen, wenn sein Thema dran ist.

Das Menüstück soll endlos laufen. Dafür wird es vor dem Ausklang geschnitten und zu einer nahtlosen Schleife gebaut:
Die letzten fünf Sekunden werden ausgeblendet über die eingeblendeten ersten fünf gelegt. Am Schleifenpunkt läuft die
Musik ohne Sprung weiter.

## Geräusche aus freien Aufnahmen {#sfx}

Nicht alles wird generiert. Für Arbeitsgeräusche gibt es hervorragende freie Aufnahmen. Die Projektregel lautet: nur
[CC0](https://de.wikipedia.org/wiki/Creative_Commons#Die_Lizenzen) (gemeinfrei) oder selbst erzeugt. Übernommen wurden
Holzhacken, Spitzhacke, Hammer, Klingen, Pfeiltreffer und Münzen aus den Paketen „RPG Audio“ und „Impact Sounds“ von
Kenney, der Amboss aus zwei Freesound-Aufnahmen. Das Skript `sfx-cc0.mjs` lädt die Pakete, prüft bei Freesound die
Lizenz jeder einzelnen Datei, schneidet Stille ab, setzt die Spitze auf −3 dB und schreibt die Dateien samt Manifest.

Mehrere Varianten je Geräusch plus ±4 % zufällige Tonhöhe beim Abspielen verhindern, dass hundert Holzfäller wie eine
Maschine klingen. Alles andere – Fanfaren, Oberflächenklänge, Geschütze – bleibt synthetisch, weil es dafür keine
passende Aufnahme gibt oder die Synthese gleich gut klingt.

## Was nicht klappte {#problems}

- **Lyria kann nicht kurz:** Auch „10 seconds“ ergibt rund 60 Sekunden. Sieg und Niederlage wurden deshalb am Ende
  einer Phrase geschnitten – gefunden am Verlauf der Lautheit – und ausgeblendet.
- **Zufällige Ablehnungen:** Etwa jede dritte Anfrage an Lyria kam mit `403 PROHIBITED_CONTENT` zurück, mit demselben
  Prompt klappte es im zweiten Anlauf. Das Skript überspringt Vorhandenes, also einfach erneut aufrufen.
- **„Im Stil von …“** wird angenommen, hilft aber nicht – und Namen aus dem Vorbild gehören ohnehin nicht ins Projekt.
- **Seed Audio** vertonte bildhafte Wörter als Kulisse: Bei Wörtern wie „Pferde“ oder „Tor“ erzeugte es passende
  Hintergrundgeräusche. Die Vorlagensätze sind darum neutral. Auslassungspunkte führten zu Abbrüchen; sie werden vor dem Sprechen zu
  Komma oder Punkt.
- **Der Kenney-Amboss** klang zu dumpf und ohne Nachklang – ein Amboss von Freesound ersetzte ihn.
- **Sprüche** kamen zu oft und überlagerten sich; jetzt gibt es eine Einstellung „selten/oft/aus“ und Abklingzeiten.

## Zum Nachmachen {#tips}

- KI-Prüfer filtern Offensichtliches vor (Gesang, falscher Wortlaut); den Geschmack entscheidet ein Mensch.
- Vergleiche Texte auf Wortebene mit Levenshtein, nicht Zeichen für Zeichen.
- Mach Erzeugungsskripte wiederaufnehmbar – Modelle lehnen zufällig ab, Netzverbindungen brechen ab.
- Bring alle Aufnahmen auf eine Lautheit (LUFS), bevor du sie im Spiel beurteilst.
- Lass Ton nie den Spielablauf steuern: Die Simulation rechnet mit Textlängen, nicht mit Aufnahmen.
