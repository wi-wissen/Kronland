# Modelle, Figuren und Detailstufen

Wie Modelle ins Spiel kommen, welches Format eigene Figuren (z. B. aus Tripo) haben müssen und wie die
Detailstufen (LOD) funktionieren.

## Überblick

| Was | Wo | Wie gezeichnet |
|---|---|---|
| Gebäude | `public/models/buildings/*.glb` (+ `.lod1.glb`, `.lod2.glb`) | eigenes Objekt je Gebäude, Stufe nach Abstand |
| Bäume, Deko | prozedural (`src/render/nature.js`) + KayKit-Felsen | instanziert in Chunks (8×8 bzw. 6×6 Kacheln), Stufe je Chunk |
| Figuren | `public/models/characters/*.glb` + `manifest.json` | instanziert, GPU-Skinning aus gebackener Knochen-Textur |
| Rückfall | `src/render/models.js` (prozedurale Figuren) | dieselbe Instanzierung, Körperteile als „Knochen“ |

## Detailstufen (LOD)

Code: `src/render/lod.js`. Jedes Objekt bekommt einen *effektiven Abstand*: echter Abstand zur Kamera,
korrigiert um das Sichtfeld (Handy hochkant = weiteres Sichtfeld = Objekte kleiner) und die Grafikstufe
(`niedrig` vereinfacht früher). Daraus folgt die Stufe; eine Hysterese von ±10–12 % verhindert Flackern
an den Grenzen.

| Gruppe | Grenzen (Kacheln, Stufe „hoch“) | Stufen |
|---|---|---|
| Gebäude | 38 / 72 | Original → lod1 (~50–70 %) → lod2 (~25–35 %) |
| Bäume | 30 / 62 | detailliert → einfach → Fernform (≈20–30 Dreiecke, ohne Schattenwurf) |
| Figuren | 16 / 36 / 90 | voll + flüssig → lod1, Animation mit 24 Bildern/s ohne Mischung → lod2, 8 Bilder/s → lod3, starre Pose |
| Kleine Deko (Gras, Blumen, Kiesel) | ab 66 weg | schrumpft vorher im Shader in den Boden (kein Aufploppen) |

Faktor je Grafikstufe: hoch 1, mittel 0,8, niedrig 0,55 (Figuren mindestens 0,8). Werte stehen in
`LOD_PROFILES` und `LOD_TIERS`.

Gelände und Wasser sind in Kacheln geteilt (`splitGridMesh`), damit die Sichtprüfung ganze Bereiche verwirft.
Bäume und Deko liegen je Chunk zusammen; sichtbare Chunks werden nur bei Kamerabewegung neu eingesammelt
und in ein InstancedMesh je Stufe kopiert (wenige Zeichenaufrufe, egal wie viele Chunks).

**Messen:** `?debug=1` zeigt Bilder/s, Zeichenaufrufe, Dreiecke und die Anzahl je Gruppe und Stufe.
Im Code: `window.__kronland.renderer.lodStats()`.

## Detailstufen erzeugen

```bash
node scripts/build-lods.mjs                                  # alle Gebäude und Figuren
node scripts/build-lods.mjs public/models/characters/Neu.glb # nur eine Datei
node scripts/build-lods.mjs --ratios 0.5,0.2 --errors 0.01,0.04 datei.glb
```

Vereinfacht wird mit meshoptimizer (`simplifyWithAttributes`, Normalen und UV gewichtet, damit Farben der
Paletten-Textur nicht verrutschen). Skinning bleibt erhalten. Die LOD-Dateien enthalten keine Animationen
und keine Texturbilder – das Spiel nimmt Material und Clips vom Original. `scripts/build-assets.sh` ruft das
Skript am Ende automatisch auf.

## Figuren: das Manifest

`public/models/characters/manifest.json` ordnet **Rollen** einem **Modell** zu. Fehlt ein Modell oder kann es
nicht geladen werden, nimmt das Spiel die prozedurale Figur (`procedural`), ebenfalls instanziert.

```jsonc
{
  "fps": 24,                         // Abtastrate beim Backen der Animationen
  "models": {
    "Farmer": {
      "file": "Farmer.glb",           // optional, Standard: <Name>.glb
      "lods": 3,                     // Anzahl Farmer.lod1.glb … Farmer.lod3.glb
      "height": 0.95,                // Zielhöhe in Kacheln (1 Kachel ≈ 1 m im Spiel); oder "scale"
      "yaw": 0,                      // Drehung, falls das Modell nicht nach +Z schaut (Bogenmaß)
      "uvGrid": [8, 4],              // Raster für uvCells (KayKit: 8×4 Farbfelder)
      "clips": {                     // Spiel-Schlüssel → Clip-Name in der GLB
        "idle": "Idle", "walk": "Walk", "run": "Run",
        "chop": "Chop", "mine": "Pickaxe", "hammer": "Hammer", "build": "Build", "carry": "Carry",
        "attack": "Attack", "shoot": "Shoot", "die": "Death", "sit": "Sit", "ride": "Ride", "cheer": "Cheer"
      },
      "include": ["Axe"],            // starre Teile (Waffen, Hüte), die sichtbar sein sollen; "Modell:Teil" leiht von anderen Modellen
      "team": { "materials": ["Team"] },          // Spielerfarbe: Material-Name, Teilnamen ("parts"), "uvCells" oder "uvRects"
      "tint": { "uvCells": [[0, 1]], "color": "#b08452" } // zweite Färbung (Berufskittel, Räuber); Farbe pro Instanz überschreibbar
    }
  },
  "roles": {
    "serf":                 { "model": "Farmer", "procedural": "serf" },
    "soldier.sword.leader": { "fallback": "soldier.sword", "scale": 1.08 },
    "soldier.heavyCav":     { "model": "Ritter", "seat": 0.86, "clipAlias": { "walk": "ride", "idle": "ride" },
                              "attach": [{ "role": "mount.horse", "offset": [0, 0, 0.06], "scale": 1.75 }] }
  }
}
```

**Rollen**, die das Spiel verwendet (Schlüssel werden von hinten gekürzt, bis einer passt:
`soldier.bow.leader` → `soldier.bow` → `soldier`):

| Rolle | Wer |
|---|---|
| `serf` | Leibeigener |
| `worker` | Arbeiter (Kittelfarbe je Beruf über `tint`) |
| `soldier.<line>` / `soldier.<line>.leader` | `sword`, `spear`, `bow`, `lightCav`, `heavyCav`, `cannon` |
| `hero.<id>` | `bertram`, `hedda`, `gerold` |
| `bandit`, `bandit.bow` | Räuber (neutraler Missionsspieler) |
| `mount.horse`, `crew` | Reittier, Kanonenmannschaft (über `attach`) |

**Animations-Schlüssel** und Rückfälle (fehlt einer, wird der nächste genommen):
`mine → chop → attack → idle`, `build → hammer → chop`, `run → walk → idle`, `carry → walk`,
`shoot → attack`, `cheer/sit → idle`. `die` wird einmal abgespielt und bleibt auf dem letzten Bild.

## Format für eigene Figuren (Tripo u. a.)

| Punkt | Vorgabe |
|---|---|
| Dateiformat | glTF 2.0 binär (`.glb`), eine Figur je Datei, ein Skelett (`skin`) |
| Achsen | Y nach oben, Figur schaut nach **+Z**, steht mit den Füßen auf y = 0 (Ursprung zwischen den Füßen) |
| Einheiten | Meter; die Größe wird über `height` im Manifest angepasst (Leibeigener ≈ 0,9–1,0 Kachel) |
| Skelett | ≤ 64 Knochen (Humanoid, z. B. Mixamo-/Tripo-Rig), max. 4 Gewichte je Ecke; alle Teile am **selben** Skelett |
| Waffen, Hüte | als eigene Netze an Knochen gehängt (Kind eines Hand-/Kopf-Knochens) oder mitgeskinnt; Namen eindeutig, im Manifest unter `include` |
| Animationen | in derselben GLB, Namen frei (Zuordnung im Manifest). Schleifen (Idle, Walk, Run, Arbeit) nahtlos, 0,6–2 s; Death einmalig |
| Material | ein Material mit Basisfarb-Textur (PNG/JPG, ≤ 1024²), unbeleuchtet wirkende Bemalung ist ok (Licht kommt vom Spiel) |
| Spielerfarbe | **eines** davon: eigenes Material `Team` (empfohlen), eigene Teile (Umhang, Wappen) unter `team.parts`, oder Texturbereiche (`uvRects`). Die Fläche sollte in der Textur mittelhell und wenig gesättigt sein (wird umgefärbt, Helligkeit bleibt) |
| Zweitfarbe | optional wie oben unter `tint` (Kittel je Beruf, Räuberkleidung) |
| Polygone (LOD0) | Leibeigener/Arbeiter ≤ 6 000 Dreiecke, Soldat ≤ 8 000, Held/Reiter ≤ 12 000 |
| Detailstufen | per `build-lods.mjs` erzeugt: lod1 ≈ 35 %, lod2 ≈ 15 %, lod3 ≈ 6 % (Ziel: ≤ 2 000 / 900 / 400 Dreiecke) |
| Texturen in LODs | keine (das Spiel nutzt die Textur des Originals; UV müssen deshalb gleich bleiben – das Skript sorgt dafür) |

Tripo-Ausgabe ist oft hochaufgelöst (20–50 k Dreiecke). Vorher auf das LOD0-Budget reduzieren:

```bash
npx gltf-transform simplify roh.glb mittel.glb --ratio 0.25 --error 0.002
npx gltf-transform optimize mittel.glb public/models/characters/Farmer.glb --compress meshopt --texture-compress false --simplify false
```

## Neue Figur einbauen

1. GLB nach `public/models/characters/` legen (Format siehe oben).
2. Im Manifest unter `models` eintragen (Clips, Größe, Teamfarbe) und die Rolle(n) unter `roles` darauf zeigen lassen.
3. `node scripts/trim-animations.mjs public/models/characters/Farmer.glb` – entfernt Clips, die das Manifest nicht nennt.
4. `node scripts/build-lods.mjs public/models/characters/Farmer.glb` – erzeugt `Bauer.lod1…3.glb`; `"lods": 3` im Manifest.
5. Prüfen: `npx vitest run tests/render` (Manifest gültig?), Spiel mit `?debug=1&quality=high` öffnen.

## Technik der Figuren

- Beim ersten Auftreten einer Rolle werden alle benötigten Clips mit 24 Bildern/s abgetastet und als
  Matrizen in eine Float-Textur geschrieben (Breite = Knochen × 4, Höhe = Bilder). Das kostet einmalig
  wenige Millisekunden je Modell.
- Teile und Detailstufen werden zu **einem** Netz mit Knochen-Index/-Gewicht je Ecke zusammengeführt
  (starre Teile hängen mit Gewicht 1 an ihrem Knochen).
- Pro Bild schreibt die CPU je Figur nur Matrix, Animationsbild A/B + Mischung und zwei Farben in ein
  InstancedMesh je (Rolle, Stufe). Der Vertex-Shader liest die Knochen per `texelFetch` (WebGL 2).
- Sichtprüfung je Figur (Kugel gegen Frustum), Stufe nach effektivem Abstand mit Hysterese,
  Animation ab Stufe 1 ohne Bildmischung, ab Stufe 2 mit 8 Bildern/s, Stufe 3 starr.
- Schatten wirft nur Stufe 0; auf der niedrigen Grafikstufe gibt es stattdessen weiche Blob-Schatten.
- Ohne echte GPU (Software-Rasterizer) nutzt das Spiel die prozeduralen Figuren (wenige Dreiecke).
