# Ton

Alle Klänge und die Musik werden zur Laufzeit mit der Web Audio API **synthetisiert**: keine
Audiodateien im Repo, nichts urheberrechtlich Geschütztes. Liegen später eigene Dateien (z. B. aus
Stable Audio) in `public/audio/` und stehen im Manifest, spielt das Spiel diese stattdessen. Fehlt eine
Datei oder lässt sie sich nicht dekodieren, bleibt es beim synthetischen Klang.

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
| `ambient.js` | Umgebungsschichten (Sommer, Regen, Winter, Wasser, Schlacht) mit Überblendung |
| `spatial.js` | Abstandsdämpfung und Stereo-Panorama (reine Mathematik) |
| `voices.js` | Stimmenbegrenzung je Klangart, Abklingzeit, globale Obergrenze mit Vorrang |
| `battle.js` | Kampfintensität in Kameranähe, Themenwechsel mit Hysterese |
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
{ "master": 0.8, "music": 0.6, "sfx": 0.8, "ambient": 0.7, "ui": 0.7, "muted": false }
```

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
- **Musik**: mehrere Dateien eines Themas laufen nacheinander (1,5 s Pause), eine einzelne Datei wird
  geschleift (`"loop": false` verhindert das). Themenwechsel blenden über (~3 s).
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
| `build` | Aufbau (Normalfall) | heiter-gelassen, mittelalterlich, Laute, Blockflöte, Bordun, 80–90 BPM, mehrere Stücke |
| `battle` | Kämpfe in Kameranähe | treibend, Rahmentrommel, Schalmei, Moll, 110–120 BPM |
| `victory` | Sieg (einmalig) | kurze Fanfare, 4–8 s |
| `defeat` | Niederlage (einmalig) | kurze traurige Weise, 5–10 s |

**Umgebung** (`ambient`, schleifbar, 30–90 s, ohne erkennbare Einzelereignisse am Anfang/Ende)

| Name | Wann |
|---|---|
| `summer` | Sommerwetter: Wind in Blättern, Vögel |
| `rain` | Regenwetter |
| `winter` | Winter: kalter Wind |
| `water` | Kamera nahe an Fluss/See (nicht im Winter) |
| `battle` | ferner Schlachtenlärm, Lautstärke folgt der Kampfintensität |

**Effekte** (`sfx`) – Bus in Klammern; *räumlich* = nur in Kameranähe hörbar, mit Stereo-Panorama.

| Name | Auslöser | Art |
|---|---|---|
| `chop` | Leibeigener fällt Holz (abgeleitet, ~1 Schlag/s) | räumlich |
| `pickaxe` | Abbau an Stein-/Lehm-/Eisen-/Schwefelhaufen; Bergmann im Schacht | räumlich |
| `hammer` | Leibeigener baut; Ziegelbrenner | räumlich |
| `anvil` | Schmied arbeitet | räumlich |
| `saw` | Sägewerker arbeitet | räumlich |
| `chisel` | Steinmetz arbeitet | räumlich |
| `bubble` | Alchimist arbeitet | räumlich |
| `place` | Baustelle gesetzt (ui) | global |
| `buildingDone` | Gebäude fertig – kurze Fanfare (ui) | global |
| `serfBought` | Leibeigener gekauft (ui) | global |
| `coin` | Zahltag (ui) | global |
| `research` | Forschung abgeschlossen, Missionsziel erfüllt (ui) | global |
| `workerArrived` | Arbeiter eingezogen (ui) | global |
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

## Synthese und Musik

- **Effekte**: Oszillatoren mit Tonhöhenverlauf, gefiltertes Rauschen (weiß/braun), inharmonische
  Teiltöne für Metall und Glocken, Karplus-Strong-Saiten für Bogensehnen, Laute und Harfe. Jeder
  Aufruf variiert leicht (Tonhöhe ±5–12 %, Zeitversatz, Klangfarbe).
- **Stimmenbegrenzung**: je Effekt höchstens 1–4 gleichzeitige Stimmen und eine Abklingzeit
  (z. B. Münzen 0,5 s), global 24 (Handy 12) Stimmen; Oberflächenklänge haben Vorrang.
- **Räumlich**: Lautstärke nach Abstand zum Kameraziel (voll im inneren Drittel, weich bis 0 am Rand
  der Hörweite `10 + 0,8 · Kameraabstand` Kacheln), weiter herausgezoomt insgesamt leiser;
  Panorama nach Bildschirmseite (Kameradrehung berücksichtigt).
- **Musik** (`composer.js`): drei Themen, je zwei komponierte achttaktige Melodien mit Akkordfolge
  und eine Form (z. B. Intro · A · A′ · B · A · Ruhe · B′ · A′).
  - *Aufbau „Feldweg“*: D-Dorisch, 3/4, 84 BPM – Blockflöte (Dreieck + Vibrato), Lauten-Arpeggio
    (Karplus-Strong), Bordun auf D–A, Harfe an Phrasenenden.
  - *Kampf „Sturm“*: A-Äolisch, 4/4, 116 BPM – Schalmei, Lauten-Ostinato, Rahmentrommel mit Wirbeln.
  - *Menü „Krone“*: G-Mixolydisch, 3/4, 66 BPM – Harfe, Blockflöte, Bordun.
  - Variation je Abschnitt: Durchgangs- und Nachbartöne, punktiert ↔ gerade, Vorschläge in
    A′/B′, wechselnde Arpeggio-Muster; Kadenztakte bleiben unverändert. Deterministisch je Seed.
  - Themenwechsel nach Kampfintensität mit Hysterese (Kampf ab 0,45, zurück unter 0,12 nach ≥ 12 s).
- **Handy** (grober Zeiger oder ≤ 4 Kerne): günstiger Hall, weniger Stimmen, ausgedünnte Begleitung,
  seltenere Umgebungsereignisse. Verborgener Tab: `AudioContext.suspend()`.

## Prüfen

```bash
npx vitest run tests/audio            # reine Teile: Manifest, Stimmen, Räumlichkeit, Komponist, Stimmung
E2E_PORT=4212 npx playwright test e2e/audio.spec.js
npx vite --port 4290 &                # dann:
python3 scripts/audio-check.py        # rendert alles offline, prüft Pegel/Übersteuerung/Dauer/Spektrum
```

`scripts/audio-check.py` öffnet `scripts/audio-check.html` im Headless-Chromium, rendert jeden Effekt,
alle Musikthemen, Signalmelodien und Umgebungen mit `OfflineAudioContext` und prüft: keine NaN, keine
Übersteuerung, Spitze unter 0 dBFS, kein Gleichanteil, weiches Ende, plausible Dauer und
Spektralschwerpunkt, wenig Zischeln über 8 kHz. WAV-Dateien zum Anhören landen in `review/`
(nicht im Git). Im Browser bietet `/scripts/audio-check.html` Knöpfe zum Vorhören jedes Klangs.
