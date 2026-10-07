# Ton

Umgebung und die meisten Klänge werden zur Laufzeit mit der Web Audio API **synthetisiert**.
Die Musik sind erzeugte Aufnahmen (Lyria 3, siehe [Musik](#musik-lyria-3)), einige Arbeits- und Kampfgeräusche
echte Aufnahmen (CC0, siehe [Effekt-Aufnahmen](#effekt-aufnahmen-cc0)), die Stimmen sind erzeugt
(siehe [Stimmen](#stimmen)). Die generative Musik aus `composer.js` bleibt Rückfall. Was in `public/audio/` liegt und im Manifest steht, spielt
das Spiel statt der Synthese. Fehlt eine Datei oder lässt sie sich nicht dekodieren, bleibt es beim synthetischen Klang.

## Aufbau (`src/audio/`)

| Datei | Aufgabe |
|---|---|
| `AudioEngine.js` | Gemeinsamer `AudioContext` (erst beim ersten Klick/Tippen/Tastendruck, iOS-Freischaltung), Busse, Lautstärken, Pause bei verborgenem Tab, Manifest und Dateien laden, `play()` |
| `GameAudio.js` | Brücke zur `Engine`: Simulationsereignisse → Klänge, Arbeitsgeräusche aus dem Zustand, Kamera als Zuhörer, Musikthema, Umgebung |
| `sfx.js` | Prozedurale Effekte (Liste unten), je mit Länge, Stimmenregel und Bus |
| `synth.js` | Bausteine: Rauschen, Hüllkurven, Glocken, Karplus-Strong-Saiten, Hall, Musikinstrumente |
| `karplus.js` | Saitensynthese als reine Funktion (Puffer je Tonhöhe, zwischengespeichert) |
| `composer.js` | Generative Musik: komponierte Melodien + Variation, deterministisch je Seed/Abschnitt |
| `music.js` | Spielt Themen (Datei oder generativ), Überblendung, Sieg/Niederlage-Melodie |
| `ambient.js` | Umgebungsschichten (Laub, Regen, Winter, Wasser, Schlacht, Wind) mit Überblendung, seltene Vogelrufe |
| `workbeat.js` | Arbeitsschläge im Takt der Animation, gemeinsames Tor gegen Salven (reine Funktionen) |
| `spatial.js` | Abstandsdämpfung und Stereo-Panorama (reine Mathematik) |
| `voices.js` | Stimmenbegrenzung je Klangart, Abklingzeit, globale Obergrenze mit Vorrang |
| `notify.js` | Ruhezeiten für Meldungsklänge aus Massenereignissen (Einzug, Beförderung) |
| `battle.js` | Kampfintensität in Kameranähe, Kampfmusik an/aus (Beteiligung des Spielers, Nachfrist) |
| `manifest.js` | Manifest prüfen, Pfade auflösen, Datei wählen (reine Funktionen) |
| `settings.js` | Lautstärke-Einstellungen, Speicher, Brücke zur Einstellungs-Oberfläche |
| `index.js` | Öffentliche Schnittstelle |

Signalweg: Klang → (Panner) → Bus `sfx` / `ui` / `ambient` / `music` → `master` → Begrenzer → Ausgabe.
Musik hat einen eigenen Hall (Desktop: Faltungshall, Handy: zwei Verzögerungen), Effekte einen leisen
gemeinsamen Raum (nur Desktop).

In Node (Vitest) und Browsern ohne Web Audio ist alles ein stilles No-op.

## Einstellungen

Gespeichert in `localStorage['kronland-audio']` als JSON:

```json
{ "master": 0.8, "music": 0.6, "sfx": 0.8, "ambient": 0.7, "ui": 0.7, "muted": false, "musicPause": "normal", "barks": "rare" }
```

`musicPause` (`off` · `short` · `normal` · `long`) ist die Stille zwischen zwei Friedensstücken: 2–4 s,
20–45 s, 1–2 min bzw. 2,5–5 min (`MUSIC_PAUSES` in `src/audio/settings.js`). Einstellbar im
Einstellungsdialog unter Ton („Pausen zwischen Musikstücken“); die Oberfläche (`src/ui/settings.js`)
meldet den Wert per `kronland-settings`-Ereignis. `barks` (`off` · `rare` · `often`, „Sprüche der Figuren“)
regelt, wie oft Figuren beim Auswählen und bei Befehlen etwas sagen (siehe [Stimmen → Im Spiel](#im-spiel)).

Werte 0…1 (Prozentwerte > 1 werden durch 100 geteilt). Die Regler wirken quadratisch (`v²`), das
entspricht eher dem Lautstärkeempfinden.

Für eine Einstellungs-Oberfläche (z. B. `src/ui/settings.js`) gibt es drei gleichwertige Wege:

```js
import { setAudioSetting, getAudioSettings, AUDIO_LABELS } from '../audio/index.js';
setAudioSetting('music', 0.4);              // speichert und meldet per Ereignis
// oder: selbst speichern und Bescheid geben
localStorage.setItem('kronland-audio', JSON.stringify({ ...werte }));
window.dispatchEvent(new CustomEvent('kronland-settings'));
// oder: Ereignis mit Inhalt (wird übernommen und gespeichert)
window.dispatchEvent(new CustomEvent('kronland-settings', { detail: { key: 'audio.music', value: 0.4 } }));
window.dispatchEvent(new CustomEvent('kronland-settings', { detail: { audio: { muted: true } } }));
```

Ereignisse, die nichts mit Ton zu tun haben (`{ key: 'quality', … }`), werden ignoriert. Die
AudioEngine meldet eigene Änderungen ebenfalls als `kronland-settings` mit
`detail: { audio, source: 'audio' }`, damit eine offene Oberfläche ihre Regler nachführen kann.
Direktzugriff: `getAudio().setVolume('sfx', 0.5)`, `getAudio().toggleMute()`.

## Eigene Audiodateien (Stable Audio u. a.)

1. Dateien nach `public/audio/music/`, `public/audio/sfx/`, `public/audio/ambient/` legen.
   Formate: `.ogg` (empfohlen, Opus oder Vorbis), `.mp3`, `.m4a`, `.wav`, `.webm`, `.opus`.
   Safari vor iOS 17 kann kein Ogg – für maximale Verbreitung `.mp3` oder `.m4a` nehmen.
2. In `public/audio/manifest.json` eintragen. Pfade relativ zu `public/audio/`.

```json
{
  "version": 1,
  "music": {
    "menu":    ["music/menu.ogg"],
    "build":   ["music/build-1.ogg", "music/build-2.ogg", "music/build-3.ogg"],
    "battle":  { "files": ["music/battle-1.ogg", "music/battle-2.ogg"], "gain": 0.8 },
    "victory": "music/victory.ogg",
    "defeat":  "music/defeat.ogg"
  },
  "sfx": {
    "chop":    ["sfx/chop-1.ogg", "sfx/chop-2.ogg", "sfx/chop-3.ogg"],
    "coin":    { "files": ["sfx/coin.ogg"], "gain": 0.7 }
  },
  "ambient": {
    "summer":  "ambient/summer.ogg",
    "rain":    { "files": ["ambient/rain.ogg"], "gain": 0.9 }
  }
}
```

- Ein Eintrag ist ein Pfad, eine Liste von Pfaden oder ein Objekt `{ files, gain, loop }`.
  `gain` 0…4 gleicht Lautheitsunterschiede aus.
- **Mehrere Dateien** je Effekt: zufällige Auswahl ohne direkte Wiederholung, dazu ±4 % Tonhöhe.
  3–5 Varianten je häufigem Effekt (chop, pickaxe, hammer, clash) klingen deutlich natürlicher.
- **Musik**: mehrere Dateien eines Themas laufen nacheinander, ohne direkte Wiederholung. Bei den
  Friedensthemen `build` und `winter` folgt auf jedes Stück eine Pause (Einstellung `musicPause`), in der nur
  die Umgebung klingt; sonst 1,5 s. Eine einzelne Datei wird geschleift (`"loop": false` verhindert das),
  außer bei Friedensthemen. Themenwechsel blenden über (~3 s); der Wechsel zwischen `build` und `winter`
  wartet das laufende Stück ab (liegt gerade eine Pause, kommt nach ihr gleich das neue Thema).
- **Umgebung**: wird immer geschleift; die Datei ersetzt die synthetische Fläche der Schicht.
  Vogelrufe bzw. Tropfen kommen dann nicht mehr zusätzlich (Donner und ferne Klingen schon).
- Unbekannte Namen, absolute Pfade, `..` und fremde Adressen werden ignoriert.
- Das Manifest wird beim Start ohne Cache geladen; die PWA hält Audiodateien nach dem ersten Abspielen
  offline vor. Fehlt `manifest.json` ganz, ist alles synthetisch.

### Namen

**Musik** (`music`)

| Name | Wann | Hinweise für die Erzeugung |
|---|---|---|
| `menu` | Start- und Kampagnenbildschirm | ruhig, feierlich, Harfe/Laute/Flöte, 60–70 BPM, 1–3 min, schleifbar |
| `build` | Aufbau (Normalfall) | heiter-gelassen, mittelalterlich, Laute, Blockflöte, Bordun, 75–95 BPM, mehrere Stücke |
| `winter` | Aufbau bei Winterwetter (fehlt es, spielt `build`) | still, kalt, gemütlich; Celesta, Harfe, Flöte, keine Trommeln |
| `battle` | Kämpfe in Kameranähe | treibend, Rahmentrommel, Schalmei, Moll, 110–125 BPM |
| `victory` | Sieg (einmalig) | kurze Fanfare, 5–25 s |
| `defeat` | Niederlage (einmalig) | kurze traurige Weise, 5–15 s |

**Umgebung** (`ambient`, schleifbar, 30–90 s, ohne erkennbare Einzelereignisse am Anfang/Ende)

| Name | Wann |
|---|---|
| `summer` | Sommer, nur bei Wald nahe der Bildmitte: Laubrascheln (Datei darf Vögel enthalten, dann keine synthetischen) |
| `rain` | Regenwetter |
| `winter` | Winter: kalter Wind |
| `wind` | Wind in der Höhe bzw. im Gebirge: nur weit herausgezoomt oder bei vielen Steilhängen im Bild |
| `water` | Kamera nahe an Fluss/See (nicht im Winter) |
| `battle` | ferner Schlachtenlärm, Lautstärke folgt der Kampfintensität |

**Effekte** (`sfx`) – Bus in Klammern; *räumlich* = nur in Kameranähe hörbar, mit Stereo-Panorama.

| Name | Auslöser | Art |
|---|---|---|
| `chop` | Leibeigener fällt Holz (ein Schlag je Axt-Animation, siehe [Arbeitsgeräusche](#arbeitsgeräusche)) | räumlich |
| `pickaxe` | Abbau an Stein-/Lehm-/Eisen-/Schwefelhaufen (je Spitzhacken-Animation); Bergmann im Schacht | räumlich |
| `hammer` | Leibeigener baut (je Hammer-Animation); Ziegelbrenner | räumlich |
| `anvil` | Schmied arbeitet | räumlich |
| `saw` | Sägewerker arbeitet | räumlich |
| `chisel` | Steinmetz arbeitet | räumlich |
| `bubble` | Alchimist arbeitet | räumlich |
| `place` | Baustelle gesetzt (ui) | global |
| `buildingDone` | Gebäude fertig – kurze Fanfare (ui) | global |
| `serfBought` | Leibeigener gekauft (ui) | global |
| `coin` | Zahltag (ui) | global |
| `research` | Forschung abgeschlossen, Missionsziel erfüllt (ui) | global |
| `workerArrived` | Arbeiter eingezogen (ui), höchstens alle 8 s (`notify.js`) | global |
| `upgrade` | Ausbau begonnen, Truppenlinie verbessert (ui) | global |
| `blessing` | Segen in der Kapelle (ui) | global |
| `recruited` | Truppe rekrutiert – Hornruf (ui) | global |
| `clash` | Nahkampftreffer | räumlich |
| `arrowShot` / `arrowHit` | Bogenschuss / Einschlag (verzögert um Flugzeit) | räumlich |
| `ballista` | Turmschuss (Balliste) | räumlich |
| `cannon` | Kanonenschuss | räumlich |
| `explosion` | Bombe explodiert | räumlich, eigene auch fern leise |
| `death` | Einheit fällt | räumlich |
| `heroDown` | eigener Held bewusstlos (ui) | global |
| `buildingCrash` | Gebäude zerstört | räumlich, eigene auch fern leise |
| `whirl`, `might`, `heal`, `trap`, `fuse`, `turret` | Heldenfähigkeiten (fuse = Bombe gelegt) | räumlich |
| `thunder` | gelegentlich bei Regen (ambient) | global |
| `click`, `hover`, `confirm`, `error`, `notify`, `open` | Oberfläche: Knopf, Maus über Knopf, Hauptknopf (`.primary`), abgelehnter Befehl, Hinweis/Welle, Dialog (ui) | global |

Effekt-Dateien: kurz (≤ 2 s, Explosion/Einsturz ≤ 4 s), ohne Stille am Anfang, mit kurzem Ausklang,
Spitzenpegel um −3 dBFS; Lautheit untereinander angleichen, Feinabstimmung über `gain`.
Ein Knopf mit `data-no-sound` bleibt stumm.

## Effekt-Aufnahmen (CC0)

Wo eine echte Aufnahme klar besser klingt als die Synthese, liegt sie als MP3 in `public/audio/sfx/` und steht
im Manifest. Quellen: Kenney „RPG Audio“ und „Impact Sounds“ (kenney.nl, CC0), für den Amboss einzelne
Aufnahmen von Freesound (nur CC0, Lizenz wird beim Laden auf der Seite des Klangs geprüft).

| Effekt | Dateien | Quelle | `gain` |
|---|---|---|---|
| `chop` | 3 | RPG Audio `chop` (Original, Tonhöhe ×0,9 und ×1,08) | 1,15 |
| `pickaxe` | 4 | Impact `impactMining_000/001/003/004` | 0,95 |
| `hammer` | 3 | Impact `impactWood_light_000/002/004` | 1,4 |
| `anvil` | 5 | Freesound [„Hammer and anvil“](https://freesound.org/people/Duasun/sounds/321889/) (Duasun, 4 Schläge) und [„Anvil – Lokomo 125 kg“](https://freesound.org/people/ldezem/sounds/386129/) (ldezem), je bis 1,6 s Nachklang | 0,5 |
| `clash` | 4 | Impact `impactMetal_light_000…003` | 0,6 |
| `arrowHit` | 3 | Impact `impactWood_medium_000/002/004` | 1,0 |
| `coin` | 2 | RPG Audio `handleCoins`, `handleCoins2` | 0,5 |

Alle anderen Effekte bleiben synthetisch: Oberflächenklänge, Fanfaren und Signale (bewusst schlicht und
stimmig mit der Musik), `saw`, `chisel`, `bubble`, `arrowShot`, Geschütze, Explosion, Einsturz, `death`,
Heldenfähigkeiten – dafür gibt es in den Paketen keine passende Aufnahme, oder die Synthese ist gleichwertig.

Neu schneiden bzw. Auswahl ändern (Tabelle `SELECTION` im Skript):

```bash
node scripts/asset-gen/sfx-cc0.mjs   # lädt Pakete/Aufnahmen (Lizenz wird geprüft), schneidet, schreibt Dateien + Manifest
```

Schnitt: Mono, Stille am Anfang weg (bei Freesound ab der angegebenen Startzeit), Ende bei −50 dB, kurze Blenden
(bei abgeschnittenem Nachklang 0,4 s Ausblenden), Spitze −3 dBFS, MP3 (Safari vor
iOS 17 kann kein Ogg). `gain` gleicht an die Lautheit der Synthese an (größter 50-ms-Effektivwert, grob
gehörgewichtet, gegen die Offline-Renderings aus `scripts/audio-check.html`). Mehrere Dateien je Effekt plus
±4 % Tonhöhe beim Abspielen verhindern hörbare Wiederholung. Etwa 115 KB insgesamt, beim Laden des Manifests
vorgeladen.

## Musik (Lyria 3)

12 Stücke in `public/audio/music/`, erzeugt mit **Google Lyria 3 Pro** über OpenRouter, ausgewählt nach Gehör
(Nutzer) und Vorprüfung mit Gemini, aufbereitet mit `scripts/asset-gen/music.mjs`. Zusammen ≈ 19 MB (MP3
112 kbit/s), jedes Stück wird erst geladen, wenn sein Thema dran ist.

| Thema | Dateien | Länge | Stimmung |
|---|---|---|---|
| `build` | `build-morning`, `-market`, `-expanse`, `-fields`, `-evening` | je 2–2,5 min | Morgen im Tal, Markttag (keltisch), weites Land, Erntefelder (3/4), Abend |
| `winter` | `winter-snow`, `winter-frost` | je 2,5 min | Celesta, Harfe, Flöte, Streicher, keine Trommeln |
| `battle` | `battle-storm`, `battle-shieldwall` | je 2 min | Kriegstrommeln, Streicher-Ostinato, Hörner/Schalmei |
| `menu` | `menu` | 1,5 min, nahtlose Schleife | Harfe, Laute, Horn-Thema |
| `victory` / `defeat` | je 1 | 25 s / 16 s | Fanfare / Klage (Cello) |

Situation statt Ort: Musik hängt am Spielzustand (Frieden/Winter/Kampf), Orte wie Markt oder Schmiede klingen
über die räumlichen Effekte und die Umgebung. Im Frieden folgt auf jedes Stück eine Pause (Einstellung
`musicPause`), damit sich die Musik über Stunden nicht abnutzt – üblich in Aufbauspielen.

### Ablauf

```bash
export NODE_USE_ENV_PROXY=1     # nur in der Cloud-Umgebung: Node-fetch nimmt sonst den Proxy (und den Schlüssel) nicht
node scripts/asset-gen/music.mjs gen build 2      # je Prompt in THEMES zwei Entwürfe → assets-src/music/raw/build/
node scripts/asset-gen/music.mjs rate build       # Gemini-Urteil (Gesang? Störstellen? Note) als .json daneben
node scripts/asset-gen/music.mjs process          # Auswahl PICK schneiden, angleichen → public/audio/music + Manifest
```

Prompts (`THEMES`) und Auswahl (`PICK`, mit Schnittpunkten) stehen im Skript. Die Roh-MP3s (≈ 3,5 MB je Stück)
liegen nicht im Git, nur die Gemini-Urteile; mit denselben Prompts lassen sie sich neu erzeugen (nicht identisch).
Aufbereitung: Stille vorn/hinten weg, 0,3 s Ein- und 3 s Ausblenden, Lautheit auf **−22 LUFS** (Frieden, Menü)
bzw. **−20 LUFS** (Kampf, Sieg/Niederlage), Begrenzer bei −1,5 dBFS, MP3 112 kbit/s. Das Menü wird vor dem
Ausklang geschnitten und als Schleife gebaut: die letzten 5 s ausgeblendet über die eingeblendeten ersten 5 s
gelegt, dann der Mittelteil – am Schleifenpunkt läuft die Mitte ohne Sprung in das Ende weiter.

### Erfahrungen

- **Modelle auf OpenRouter** (Stand Okt. 2026): Musik nur `google/lyria-3-pro-preview` (0,08 $ je Stück,
  bis ca. 2,5 min, Länge per Prompt) und `google/lyria-3-clip-preview` (0,04 $, immer 30 s). Für Klangeffekte
  gibt es dort kein Modell; `openai/gpt-audio` und die TTS-Modelle können nur Sprache.
  Aufruf: `chat/completions` mit `modalities: ["text","audio"]`, `stream: true`, Audio kommt base64 in
  `delta.audio.data` (MP3, 44,1 kHz Stereo). Jede Ausgabe trägt ein unhörbares SynthID-Wasserzeichen.
- **Prompts**: Instrumente, Tempo, Tonart, Stimmung und Form (`[Intro] [A] [B] [A'] [Outro]`) genau beschreiben
  wirkt; „im Stil von *Spieltitel*“ wird angenommen, hilft aber nicht (klang beliebig) – und Namen aus Siedler
  gehören ohnehin nicht ins Projekt. „Instrumental only, no vocals, no choir“ ausdrücklich: trotzdem hatte etwa
  jeder fünfte Entwurf Gesang oder Chor – die Gemini-Prüfung erkennt das zuverlässig.
- **Zufällige Ablehnungen**: etwa jede dritte Anfrage kam mit `403 PROHIBITED_CONTENT` zurück, beim selben Prompt
  klappte es im zweiten Anlauf. `gen` überspringt Vorhandenes, also einfach erneut aufrufen.
- **Kurze Stücke** gibt es nicht: auch „10 seconds“ liefert ≈ 60 s. Sieg/Niederlage daher am Phrasenende
  (Lautheitsverlauf) geschnitten und ausgeblendet.
- **Lautheit**: Lyria liefert ≈ −11 LUFS mit Spitzen bei 0 dBFS – wie Popmusik, für Hintergrundmusik viel zu
  laut. Zum Vergleich: die synthetische Musik liegt bei Einheitspegel um −23 (Aufbau) bzw. −22 LUFS (Kampf),
  gemessen mit `scripts/audio-check.html`. Richtwerte für die Gesamtmischung: −24 LUFS (PC/Konsole) bzw.
  −18 LUFS (Handy), Spitzen ≤ −1 dBTP (Sony ASWG-R001).
- **Tempo** üblicher Spielmusik: Aufbau/Erkunden 70–95 BPM, Menü 80–100, Kampf 110–140, ohne Gesang,
  gleichmäßige Dynamik.
- **Gemini als Ohr** (`google/gemini-3.8-flash`): verlässlich für Gesang, Instrumente und harte Brüche;
  die Noten sind fast immer 1–2 und taugen nicht zur Rangfolge, BPM-Angaben sind grob. Entschieden hat der Nutzer.

### Recherche: freie Quellen (Okt. 2026)

Gesucht wurde nach fertigen Klängen mit „Siedler-Gefühl“. Regel des Projekts: nur CC0 oder selbst erzeugt.

| Quelle | Lizenz | Ergebnis |
|---|---|---|
| [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), [Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0 | übernommen (Effekte, siehe oben) |
| [Freesound](https://freesound.org) mit Filter „Creative Commons 0“ | CC0 je Datei | Amboss übernommen (Kenney-Amboss klang zu dumpf, ohne Nachklang); gut auch für Umgebung (Dorf, Vögel, Wasser) |
| OpenGameArt, z. B. [The Old Tower Inn](https://opengameart.org/content/medieval-the-old-tower-inn) (RandomMind), Sammlung [CC0 Fantasy Music & Sounds](https://opengameart.org/content/cc0-fantasy-music-sounds) | CC0 (je Stück prüfen) | eher Rollenspiel-Taverne; nicht genutzt |
| [Village Medieval Music Pack](https://thesoundrack.itch.io/village-medieval-music-pack) | CC BY 4.0 | passt nicht (Nutzerentscheid) |
| [Sonniss GDC Bundle](https://sonniss.com/gdc-bundle-license/) | lizenzfrei, aber keine Weitergabe der Rohdateien, kein KI-Training | ungeeignet: im offenen Repo/Browserspiel sind die Dateien einzeln abrufbar |
| Pixabay, Kaufpakete (Medieval Town SFX u. a.) | eigene Lizenzen | ausgeschlossen |

## Stimmen

Missionsdialoge und kurze Sprüche der Figuren (beim Auswählen und bei Befehlen) sind vertont, auf Deutsch und
Englisch. Alle Stimmen sind für dieses Projekt erzeugt.

### Vorgehen

1. **Rollen festlegen.** Jeder Sprecher der Missionen bekommt eine Stimme, dazu Leibeigener, Leibeigene,
   Schwertkämpfer, Soldatin und Kanonier. Speerträger und Reiter sprechen mit der Stimme des Schwertkämpfers,
   Bogenschützen und leichte Reiter mit der Soldatin – passend zur Optik: Welche Stimme eine Figur hat, steht im
   Figuren-Manifest (`voice` an der Rolle bzw. an der Variante der Leibeigenen). Darstellung und Ton wählen die
   Variante mit derselben Funktion (`src/render/variants.js`).
2. **Stimmen beschreiben.** Je Rolle zwei bis drei Beschreibungen auf Deutsch – Alter, Stimmfarbe, Haltung
   (`assets-src/voices/cast.json`), z. B. „mächtiger Fürst, etwa fünfundfünfzig, rauer Bass, langsam und drohend“.
3. **Entwürfe erzeugen.** Seed Audio erzeugt aus jeder Beschreibung einen Satz; die Beschreibung steht in eckigen
   Klammern vor dem Text und wird nicht gesprochen. Dazu immer: „reine trockene Sprachaufnahme, nur die Stimme,
   keine Musik, keine Hintergrundgeräusche“. Der Satz ist neutral und nicht zu kurz (ohne bildhafte Wörter wie
   „Pferde“ oder „Tor“, die das Modell als Kulisse vertont); er dient später als Vorlage zum Klonen.
4. **Klonen.** Ein zweiter Satz wird aus dem Entwurf geklont – so klingt die Figur später in allen Sätzen.
5. **Prüfen lassen.** Ein zweites Modell hört jede Aufnahme nach: Stimmt der gesprochene Wortlaut mit dem Text
   überein (Wort-Ähnlichkeit ≥ 0,85) und ist nur die Stimme zu hören? Sonst wird die Aufnahme neu erzeugt (bis zu
   sechs Versuche). Ersetzt wird eine Datei nur durch einen bestandenen Versuch. Der Prüfer erfährt die Sprache
   (sonst hört er englisches „Aye“ als „Hi“); längere Wörter dürfen um einen Buchstaben abweichen (Namen wie
   „Orrin“). Auslassungspunkte gehen als Komma bzw. Punkt an Seed – lange Pausen lassen das Modell abbrechen
   oder Geräusche einfügen.
6. **Auswählen.** Die Entwürfe (Entwurf + Klon, gleiche Lautheit) stehen auf einer Hörseite; ein Mensch wählt je
   Rolle eine Stimme oder beschreibt neu. Die gewählte Aufnahme wird die Vorlage der Rolle.
7. **Vertonen.** Alle Sätze werden aus der Vorlage geklont, geprüft, auf dieselbe Lautheit gebracht
   (EBU R128, −18 LUFS, Spitze −1,5 dBTP) und als MP3 (mono, 48 kbit/s) abgelegt.

### Modelle

| Zweck | Modell (über OpenRouter, `/api/v1/audio/speech` bzw. `/chat/completions`) |
|---|---|
| Stimme aus Beschreibung, Klonen | ByteDance Seed Audio 1.0 (`bytedance-seed/seed-audio-1-0`), Vorlage über `input_references` (Aufnahme + Wortlaut) |
| Hörprüfung (Wortlaut, Geräusche) | Google Gemini 3.8 Flash (`google/gemini-3.8-flash`) mit Audio-Eingabe |
| Lautheit, Formate | ffmpeg (`loudnorm`, MP3) |

### Ablage

| Ort | Inhalt |
|---|---|
| `assets-src/voices/cast.json` | Rollen, Beschreibungen, Vorlagensätze, Wahl; `speakers`: welche Stimme welche Sprüche spricht |
| `assets-src/voices/<rolle>/voice.wav`, `voice.json` | Vorlage der Rolle (Ausgangsquelle) mit Modell, Beschreibung und Wortlaut |
| `assets-src/voices/<rolle>/raw/` | unbearbeitete Aufnahmen des Modells je Satz (`<sprache>-<schlüssel>.mp3`) |
| `public/audio/voice/<sprache>/<rolle>-<schlüssel>.mp3` | Spieldateien (lautheitsangeglichen) |
| `public/audio/voice/index.json` | Stimme + Sprache + Text → Datei |
| `src/audio/barks.js` | Sprüche je Rolle und Anlass (zweisprachig) |

```bash
node scripts/asset-gen/voice.mjs audition [rolle …]          # Hörproben je Beschreibung (Entwurf + Klon)
node scripts/asset-gen/voice.mjs pick <rolle> <nr> [quelle]  # Entwurf als Vorlage übernehmen
node scripts/asset-gen/voice.mjs lines [rolle …]             # alle Dialoge und Sprüche vertonen (fortsetzbar)
```

Neue oder geänderte Texte: `lines` erzeugt nur, was fehlt (der Schlüssel hängt am Text). Fehlt eine Aufnahme,
liest der Browser den Dialog vor (Einstellung „Dialoge vorlesen“), Sprüche bleiben dann still.

### Im Spiel

- **Dialoge** (`src/audio/speech.js`): Zum Sprecher und Text der Mitteilung wird die Aufnahme gesucht; sonst
  Sprachausgabe des Browsers. Der nächste Satz wartet, bis die Aufnahme zu Ende ist (`speak(…, { onEnd })`).
  Solange eine Stimme spricht, treten Musik (22 %) und Umgebung (55 %) zurück (`AudioEngine.duck`).
- **Warnrufe** (`GameAudio.alarm`, aus `Engine.attackToast`): Wird Eigenes angegriffen, läutet die Sturmglocke
  (`alarm` in `sfx.js`) und die getroffene Figur ruft (Anlass `alarm` in `barks.js`; bei Gebäuden ein Leibeigener,
  Arbeiter(innen) und Miliz mit der Leibeigenen-Stimme ihres Geschlechts `serf`/`serfF` (`GameAudio.alarmVoiceOf`),
  Soldaten wie ihr Hauptmann). Unabhängig von der Einstellung
  „Sprüche der Figuren“, höchstens alle 20 s (`ALARM_REST`), nie über einen Dialog. Läuft gerade ein Spruch,
  wartet der Ruf dessen Ende ab (höchstens 5 s, `ALARM_WAIT`); die Ruhepause nach Sprüchen gilt nicht.
  Gewählt wird nur ein Satz, zu dem es in der Stimme eine Aufnahme gibt (`GameAudio.alarmLine`); sonst ruft ein
  Ersatz (`alarmVoices`: Leibeigener bzw. Schwertkämpfer). Gesprochene Rufe stehen zur Prüfung in
  `GameAudio.announced` (`{ kind, role, voice, url, played, skipped }`).

  | Meldung | Warnruf | vorher |
  |---|---|---|
  | „Angriff auf …“ (Gebäude) | Leibeigener | ja (außer nach einem Spruch) |
  | „Eure Siedler werden angegriffen!“ | Leibeigener in seiner Stimme | ja; Miliz stumm (Speerträger-Sätze ohne Aufnahme in Leibeigenen-Stimme) |
  | „Eure Truppen sind im Kampf!“ | Hauptmann/Soldat bzw. Held | **nein**, wenn ein Soldat getroffen wurde (meist): Soldaten hatten keine Sprechrolle; Malvor ohne Warnrufe |
  | Held gefallen, Gebäude brennt/zerstört, Ziel erfüllt/verfehlt, Welle | – (nur Effekt: `heroDown`, `notify`, `buildingCrash`, `research`/`error`) | gleich |

  Außerdem verschluckte die Ruhepause nach einem Spruch (8 s bei „Selten“) den Ruf – typischerweise nach dem
  Angriffsbefehl („Drauf!“) –, und die 20 s Sperre galt trotzdem. Prüfung: `tests/audio/alarm.test.js` (jede
  getroffene Figurart × de/en hat eine Aufnahme), `e2e/audio.spec.js` (echter Kampf).
- **Sprüche** (`GameAudio.bark`, Regeln in `BarkGate`/`BARK_RULES`, `src/audio/barks.js`): beim Auswählen
  (Held vor Hauptmann vor Leibeigenem) und bei Befehlen (Laufen, Angreifen, Bauen, Abbauen) – aber **meist
  bleibt es still**, sonst nervt das beim Herumschicken. Einstellung „Sprüche der Figuren“:

  | Stufe | Auswahl | Befehl | Angriff | Held | Ruhe nach einem Spruch | Weitere Anlässe derselben Handlung |
  |---|---|---|---|---|---|---|
  | Aus | – | – | – | – | – | – |
  | Selten (Standard) | 20 % | 30 % | 50 % | 50 % | 8 s | still |
  | Oft | 70 % | 80 % | 100 % | 90 % | 2,5 s | sprechen, ab dem dritten manchmal Murren |

  **Eine Handlung**: Auswählen und Herumschicken derselben Figur zählen zusammen, solange zwischen zwei
  Anlässen weniger als 12 s liegen. Bei „Selten“ darf nur der erste Anlass einen Spruch auslösen – wer hin und
  her geschickt wird, schweigt danach.

  Nie zwei Sprüche übereinander: gesperrt wird bis zum Ende der Aufnahme (Länge der Datei, nicht geschätzt)
  plus Ruhe. Derselbe Satz kommt je Rolle nie zweimal hintereinander. Still, während ein Dialog läuft.
  Lautstärke über den Effekt-Regler. (Früher sperrte eine feste Pause von 1,8 s – kürzer als viele Aufnahmen
  mit bis zu 2,7 s Sprache –, daher überlagerten sich Sprüche; jede Auswahl sprach.)

## Arbeitsgeräusche

Arbeitsgeräusche der Leibeigenen folgen der **Animation** (`src/audio/workbeat.js`, `GameAudio.workFrame`):

- `onTick` merkt sich die arbeitenden Leibeigenen in Hörweite (nicht im Nebel). Pro Bild fragt `workFrame` bei der
  Darstellung den Takt der Figur ab (`CharacterSystem.beat(id)`: gezeigter Clip, Zeit im Clip, Zykluslänge,
  tatsächlich gespielte Animation) und spielt **genau einen Schlag je Zyklus**, wenn das Werkzeug aufschlägt.
- Stelle des Aufschlags (`STRIKE_PHASE`, gemessen an der Höhe der rechten Hand in den Clips der Leibeigenen):
  `hammer` 1,62 s von 1,87 s, `chop` 1,17 s von 2,53 s, `mine` 0,93 s von 2,53 s; prozedurale Figuren
  (`work`, 0,9 s) in der Mitte. Ohne Darstellung (Tests) gilt ein fester Rückfalltakt (`STRIKE_PERIOD`).
- **Gemeinsames Tor** (`StrikeGate`): je Klangart höchstens ein Schlag je `STRIKE_GAP` (Hammer 0,42 s, Axt und
  Spitzhacke 0,45 s, Amboss 0,6 s, Säge 0,9 s, Meißel 0,4 s, Kessel 1,2 s), verschiedene Arten mindestens 0,12 s
  versetzt, 0–60 ms Zufallsverzögerung, Lautstärke ±13 % gestreut. Die Schläge eines Bildes kommen nach Nähe zur
  Bildmitte dran; ein deutlich lauterer (näherer) Schlag darf schon nach dem halben Abstand. Entfernte sind über
  die [räumliche Mischung](#räumlicher-klang) leiser.
- Werkstätten (Arbeiter im Gebäude, ohne sichtbare Animation) schlagen weiter je Arbeiter alle 2,3 s Spielzeit,
  ebenfalls durch das Tor. Pausiert das Spiel, schweigt die Arbeit.

Vorher (gemessen über 60 s, 3 Leibeigene mit aufeinanderfolgenden Nummern an einer Baustelle): 257 Hammerschläge,
Abstand 0,1–0,4 s – drei Schläge kurz hintereinander, alle 0,7 s, unabhängig von der Animation (1,87 s je Schlag).
Ein einzelner Leibeigener schlug 86-mal statt 32-mal je Minute. Nachher: 32/min für einen, 64/min für drei,
höchstens 97/min für viele, nie zwei Hammerschläge unter 0,42 s.

## Umgebung: ruhig, nur mit Anlass

- **Vögel** (`Ambient.birds`): nur im Sommer, wenn Wald nahe der Bildmitte steht (Bäume im Umkreis von 10 Kacheln,
  ab 10 % von „dicht“) und die Kamera nicht weit draußen ist (Abstand < 45). Ein einzelner kurzer Ruf, danach
  20–60 s Ruhe, bei wenig Wald bis 2,5× länger, Handy 1,5×; nie zweimal dieselbe Rufart hintereinander; leise
  (höchstens 0,022, etwa −5 dB gegenüber vorher) und etwas tiefer, mit weniger Tönen. Kommt die Kamera an einen
  Wald, vergehen erst 6–16 s. Eine Tageszeit gibt es im Spiel nicht.
  Vorher: ein Ruf alle 3–10 s, in 40 % mit zweitem Ruf (≈ 13 Rufe je Minute), immer im Sommer, überall.
- **Wind** (`windTarget`): vorher lag im Sommer immer ein tiefes Rauschen („Wind in den Blättern“, Pegel 0,75) –
  ohne sichtbaren Anlass. Jetzt eigene Schicht `wind`, nur weit herausgezoomt (ab Kameraabstand 50, voll bei 75)
  oder bei vielen Steilhängen im Bild (Gebirge, ab 15 % der Kacheln), höchstens 0,3, ein- und ausgeblendet über
  etwa 6 s. Im Winter heult die Winterschicht (jetzt 0,5 statt 0,8). Im Sommer bleibt nur leises Laubrascheln
  bei Wald.

## Räumlicher Klang

Man hört, was **um die Bildmitte** passiert, nicht alles, was zu sehen ist (`src/audio/spatial.js`):

- **Zuhörer** ist das Kameraziel (Bildmitte), nicht die Kamera. Abstand `d` = waagerechter Abstand in Kacheln.
- **Hörweite** `R = 6 + 0,3 · Kameraabstand` Kacheln (nah 7, mittlerer Zoom ≈ 15, ganz draußen ≈ 28). Der
  sichtbare Ausschnitt ist etwa `10 + 0,8 · Kameraabstand` – Figuren in der äußeren Bildhälfte bleiben also still.
- **Lautstärke**: im inneren Viertel der Hörweite voll, dann weich (quadratisch) auf 0 am Rand.
- **Zoom**: bis Kameraabstand 15 voll, weiter draußen leiser bis auf 35 % – von oben hört man die Arbeit nur
  noch gedämpft.
- **Panorama** nach Bildschirmseite (Kameradrehung berücksichtigt).
- **Viele gleiche Quellen** (mehrere Holzfäller, Bauleute): siehe [Arbeitsgeräusche](#arbeitsgeräusche) – je
  Klangart höchstens ein Schlag je ~0,4 s, nahe vor fernen. Dahinter begrenzt `voices.js` je Klangart auf
  2 Stimmen mit 0,3 s Abklingzeit.
- **Nebel des Krieges**: dort Verborgenes ist stumm. Wichtige eigene Ereignisse außerhalb der Hörweite
  (z. B. Gebäude fertig) kommen leise ohne Raum.
- **Großflächiges** richtet sich nach dem sichtbaren Ausschnitt, nicht nach der Hörweite: Kampfmusik und
  Schlachtlärm (Kämpfe im Bild), Wasser in der Umgebung.

Vorher reichte die Hörweite `10 + 0,8 · Kameraabstand` etwa bis zum Bildrand: Ein Holzfäller am Rand war
noch zu hören, mehrere klangen wie ein Wald voller Äxte.

## Synthese und Musik

- **Effekte**: Oszillatoren mit Tonhöhenverlauf, gefiltertes Rauschen (weiß/braun), inharmonische
  Teiltöne für Metall und Glocken, Karplus-Strong-Saiten für Bogensehnen, Laute und Harfe. Jeder
  Aufruf variiert leicht (Tonhöhe ±5–12 %, Zeitversatz, Klangfarbe).
- **Stimmenbegrenzung**: je Effekt höchstens 1–4 gleichzeitige Stimmen und eine Abklingzeit
  (z. B. Münzen 0,5 s), global 24 (Handy 12) Stimmen; Oberflächenklänge haben Vorrang.
- **Meldungen aus Massenereignissen** (`notify.js`, `NOTIFY_REST`): Ereignisse, die von selbst in Schüben
  kommen, klingen höchstens einmal je Ruhezeit – Einzug neuer Arbeiter (`workerArrived`, Harfen-Dreiklang) 8 s,
  Beförderung einer Truppe (`upgrade`) 5 s. Der erste Klang eines Schubs spielt, die folgenden schweigen.
  Anlass: Auf dem Schaukasten schicken vier eigene Dorfzentren je alle 3 s einen Arbeiter (~140 Einzüge in den
  ersten zwei Minuten); mit 0,4 s Abklingzeit war das ein Dauer-„Klingeling“, auf dem Gewimmel ebenso die
  Beförderungen in den Dauerschlachten. Zählhilfe: `window.__kronlandAudio.played` (gespielte Effekte je Name).
- **Räumlich**: siehe [Räumlicher Klang](#räumlicher-klang).
- **Musik** (`composer.js`, Rückfall, solange keine Datei geladen ist; kein Winterthema): drei Themen, je zwei komponierte achttaktige Melodien mit Akkordfolge
  und eine Form (z. B. Intro · A · A′ · B · A · Ruhe · B′ · A′).
  - *Aufbau „Feldweg“*: D-Dorisch, 3/4, 84 BPM – Blockflöte (Dreieck + Vibrato), Lauten-Arpeggio
    (Karplus-Strong), Bordun auf D–A, Harfe an Phrasenenden.
  - *Kampf „Sturm“*: A-Äolisch, 4/4, 116 BPM – Schalmei, Lauten-Ostinato, Rahmentrommel mit Wirbeln.
  - *Menü „Krone“*: G-Mixolydisch, 3/4, 66 BPM – Harfe, Blockflöte, Bordun.
  - Variation je Abschnitt: Durchgangs- und Nachbartöne, punktiert ↔ gerade, Vorschläge in
    A′/B′, wechselnde Arpeggio-Muster; Kadenztakte bleiben unverändert. Deterministisch je Seed.
  - Themenwechsel: siehe [Kampfmusik](#kampfmusik).
- **Handy** (grober Zeiger oder ≤ 4 Kerne): günstiger Hall, weniger Stimmen, ausgedünnte Begleitung,
  seltenere Umgebungsereignisse. Verborgener Tab: `AudioContext.suspend()`.

## Kampfmusik

`BattleMeter` (`src/audio/battle.js`), Werte in `BATTLE_MUSIC` (`src/audio/settings.js`):

- **Hitze**: Treffer, Schüsse, Gefallene und Explosionen im sichtbaren Bereich hinterlassen Hitzepunkte;
  daraus die Intensität 0…1 um die Bildmitte (Schlachtlärm der Umgebung, Musik).
- **Beteiligung**: `GameAudio.onEvents` meldet jeden Treffer bzw. Schuss, bei dem Angreifer oder Ziel dem
  Spieler gehört, und jeden eigenen Gefallenen (`battle.combat(now)`).
- **Kampf an**: Intensität ≥ 0,45 (`enter`) *und* der Spieler kämpft (letzte Beteiligung < `grace`). Fremde
  Kämpfe im Bild bringen nur Schlachtlärm, keine Kampfmusik.
- **Wieder an**: Bis `rearm` = 120 s nach dem Ende des Kampfthemas reicht schon Intensität ≥ 0,15 (`reenter`)
  bei eigener Beteiligung – flammt der Kampf wieder auf, weicht die gerade begonnene Friedensmusik sofort.
- **Nachsehen**: Entwicklermodus → „Statistik“, Zeile „Kampfmusik“ (Modus, Intensität/Schwelle, Beteiligung,
  gewünschtes → spielendes Thema).
- **Kampf aus**: `grace` = 16 s ohne Beteiligung des Spielers (frühestens `minHold` = 9 s nach Beginn) – oder
  die Kamera ist weg: Intensität ≤ 0,12 (`exit`) seit `hold` = 12 s. Danach klingt die restliche Hitze mit
  2,5 s statt 4 s Halbwertszeit ab (`releaseHalfLife`), der Schlachtlärm verstummt mit.
- **Übergang**: Das Kampfthema blendet über `fadeOut` = 4,5 s aus, die Friedensmusik blendet darunter ein
  (`Music.startWanted`; andere Wechsel 3 s).

Vorher hing das Ende nur an der Hitze: Bei großen Kämpfen (je Stelle bis 60, Halbwertszeit 4 s) fiel sie erst
25–30 s nach dem letzten Treffer unter 0,12, dazu 12 s Mindestdauer ab dem letzten heißen Moment – die
Kampfmusik lief nach dem Kampf eine halbe Minute weiter, beim Zuschauen fremder Kämpfe sprang sie ebenfalls an.

## Prüfen

```bash
npx vitest run tests/audio            # reine Teile: Manifest, Stimmen, Räumlichkeit, Komponist, Stimmung,
                                      # Arbeitstakt und Ruhe (tests/audio/quiet.test.js),
                                      # Meldungs-Ruhezeiten auf dem Schaukasten (tests/audio/notify.test.js)
E2E_PORT=4212 npx playwright test e2e/audio.spec.js
npx vite --port 4290 &                # dann:
python3 scripts/audio-check.py        # rendert alles offline, prüft Pegel/Übersteuerung/Dauer/Spektrum
```

`scripts/audio-check.py` öffnet `scripts/audio-check.html` im Headless-Chromium, rendert jeden Effekt,
alle Musikthemen, Signalmelodien und Umgebungen mit `OfflineAudioContext` und prüft: keine NaN, keine
Übersteuerung, Spitze unter 0 dBFS, kein Gleichanteil, weiches Ende, plausible Dauer und
Spektralschwerpunkt, wenig Zischeln über 8 kHz. WAV-Dateien zum Anhören landen in `review/`
(nicht im Git). Im Browser bietet `/scripts/audio-check.html` Knöpfe zum Vorhören jedes Klangs.
