# Symbole aus dem Bildmodell

Die bunten Symbole (Rohstoffe, Gebäude, Einheiten, Helden, Fähigkeiten, Wetter, Status) kommen aus einem
**Sprite-Atlas**, den ein Bildmodell in einem einzigen Durchgang gemalt hat. Die 34 einfarbigen
Bediensymbole (Pause, Menü, Schließen …) bleiben Vektoren, weil sie die Textfarbe übernehmen.

Diese Seite beschreibt, wie der Atlas entstanden ist und wie man ihn neu erzeugt, etwa für neue Symbole
oder einen anderen Stil.

## Ergebnis im Spiel

| Datei | Inhalt |
|---|---|
| `public/icons/symbols.webp` | Atlas, 12×8 Felder zu 128 px, freigestellt (Alpha) |
| `src/ui/icons/atlas.js` | Name → Feldnummer, **erzeugt**, nicht von Hand ändern |
| `src/ui/icons/Icon.vue` | zeigt Atlas-Ausschnitte als CSS-Hintergrund. Solange der Atlas lädt oder wenn ein Name fehlt, zeigt es das gezeichnete SVG aus `src/ui/icons/index.js` |
| `assets-src/icons/` | Quellen: Vorlage, Stilbilder, Prompts, Bögen beider Fassungen, Vergleichsbild |

- **Ein Bild für alle Symbole:** ein Abruf, etwa 630 KB. Die PWA legt es beim ersten Laden in den Cache
  (`globPatterns` in `vite.config.js`), danach funktioniert es offline.
- **Neue Symbole:** Ein neues Symbol in `index.js` erscheint sofort als SVG. Es kommt in den Atlas, sobald
  der Bogen neu erzeugt ist (Ablauf unten).

## Vorgehen

1. **Vorlage zeichnen.** `node scripts/icons/template.mjs`
   - Rendert alle bunten SVG-Symbole ohne Beschriftung in ein 12×8-Raster auf Weiß:
     `assets-src/icons/template.png`.
   - Hält Reihenfolge und Raster in `layout.json` fest.
   - Die Vorlage legt nur fest, *was* in welches Feld gehört.
2. **Bogen malen lassen.** Befehl:
   `NODE_USE_ENV_PROXY=1 node scripts/icons/generate.mjs openai/gpt-5.4-image-2 /tmp/bogen 2K`
   - Schickt über OpenRouter drei Bilder: die Vorlage und die beiden Figurenbögen `style-1.webp` und
     `style-2.webp` als Stilvorlage.
   - Dazu kommt ein Prompt mit Rasterliste und Stilblock. Der Stilblock steht in
     `assets-src/icons/style-prompt.txt`, verdichtet aus der [Stilreferenz](STILREFERENZ.md); dort
     lässt sich der Stil anpassen, ohne das Skript anzufassen.
   - Der Prompt wird neben das Bild geschrieben. Ein Lauf dauert etwa 2 Minuten und kostet etwa 0,40 $.
3. **Prüfen und übernehmen.**
   - Das Bild ansehen. Das Raster muss stimmen: 12 Spalten, 8 Zeilen, letzte Zeile mit 10 Symbolen.
   - Dann als `assets-src/icons/sheet.webp` ablegen (WebP, Qualität 92) und den Prompt als
     `prompt-vN.txt`.
4. **Zerlegen.** `node scripts/icons/slice.mjs --preview /tmp/vorschau.png`
   - Das Skript zerlegt den Bogen, stellt die Symbole frei und schreibt den Atlas und `atlas.js`.
   - Die Vorschau zeigt den Atlas auf dunklem und hellem Grund. Darauf achten: Säume, Schattenreste,
     angefressene helle Flächen.
5. **Testen.**
   - `npm test`: `tests/ui/icons.test.js` prüft Atlas und Layout.
   - `E2E_PORT=4310 npx playwright test e2e/icons.spec.js`: Symbole im Spiel, Desktop und Handy.

### Freistellen (`slice.mjs`)

Die Bildmodelle liefern keine Transparenz. Darum malen sie auf reinem Weiß, und das Skript rechnet das
Weiß heraus:

- **Flut vom Bildrand:** Sie erfasst helle, ungesättigte Pixel, also Weiß und graue Bodenschatten.
  Bei hellen grauen Symbolen gilt eine strenge Schwelle. Diese Symbole stehen in der Liste `LIGHT`:
  Wolke, Schneeflocke, Wirbel, Schädel, Schwertklingen …
- **Eingeschlossenes Weiß:** Größere reinweiße Flächen zählen ebenfalls als Hintergrund, zum Beispiel
  zwischen Bogen und Sehne.
- **Zurückrechnen:** Im Hintergrund und in einem 2 px breiten Saum wird „Farbe über Weiß“ zurückgerechnet.
  Kantenglättung und Schatten werden so zu halbtransparentem Dunkel und wirken auf jedem Untergrund.
- **Zuordnen:** Zusammenhängende Teile kommen per Schwerpunkt in ihr Rasterfeld. Kleine Teile wie Funken
  oder Tropfen gehen zum nächstgelegenen großen Teil, auch wenn sie in die Nachbarzeile ragen.
  Leicht verschobene Symbole stören deshalb nicht.
- **Einpassen:** Jedes Symbol wird auf sein Rechteck zugeschnitten und in ein 128-px-Feld eingepasst.

**Bekannte Grenze:** Unter einigen Symbolen bleibt ein schwacher heller Schattenrest. Wenn er stört,
das Symbol in `LIGHT` aufnehmen oder entfernen, oder die Schwellen in `isBgLike` anpassen.

## Was wir ausprobiert haben

Am 04.10.2026 wurden alle 94 Symbole in einem einzigen Bild erzeugt. Ein Vorschlag war, sie in Gruppen
zu erzeugen. Das wurde nicht gebraucht: Das Raster ist groß genug, und alles in einem Bild wirkt
einheitlicher.

| Versuch | Modell | Ergebnis |
|---|---|---|
| v1 | `openai/gpt-5.4-image-2`, 2K | Raster exakt 12×8, Inhalt sehr treu. Stil aber generisch: dünne Konturen, Clipart-Look. Der Prompt hatte „outline“ und „classic strategy icons“ verlangt. Bogen: `sheet-v1.webp` |
| v1 | `google/gemini-3-pro-image-preview`, 4K | Schöner, detailreicher Mobile-Game-Stil. Das Raster wurde aber zu 14×7 mit 4 erfundenen bzw. doppelten Symbolen, dazu Text („TAX“) trotz Verbot. Lässt sich nicht automatisch zuordnen. Bild: `compare-gemini.webp` |
| **v2** | `openai/gpt-5.4-image-2`, 2K | **Übernommen.** Mit genauer Stilbeschreibung (siehe unten) und beiden Figurenbögen als Vorlage passt der Stil zu den Figuren. Raster wieder exakt. Bogen: `sheet.webp`, Prompt: `prompt-v2.txt` |

Kosten: v1 zusammen 0,64 $, v2 0,41 $.

Danach kam die ausführliche [Stilreferenz](STILREFERENZ.md) dazu. Ihre für Symbole wichtigen Punkte
stehen jetzt in `style-prompt.txt`: matt statt glänzend, kein Plastik-Look, benutzt aber nicht dreckig,
große Farbflächen, ruhige Mimik und die Liste dessen, was zu vermeiden ist. Ein dritter Lauf damit wurde
abgebrochen, weil v2 schon überzeugt hat. `generate.mjs` nutzt beim nächsten Lauf diesen Stilblock. Der
Prompt von v2 liegt unverändert in `prompt-v2.txt`.

**Was den Stil gebracht hat (v2):**

- Ausdrücklich gesagt, dass die Vorlage nur den *Inhalt* liefert und ihr flacher Look zu ignorieren ist.
- Den Stil der Figuren in Worten beschrieben:
  - Look: gerenderter Animationsfilm, warmes Licht von links oben, **keine Konturen**, stämmige,
    abgerundete Formen
  - Materialien: abgenutztes Leder mit Nähten und Nieten, Leinen, geflickter Stoff, altes Holz
  - Farben: erdig (Oliv, Braun, Leinen), Grundfarben nur als Akzent
  - Menschen wie die Figuren: große Augen, runde Nase, Mützen; Gebäude als kleine Dioramen in
    3/4-Ansicht
- Beide Figurenbögen mitgeschickt statt nur einem.

**Tipps für einen neuen Lauf:**

- GPT hält Raster und Reihenfolge zuverlässig ein. Gemini malt schneller und günstiger, ordnet aber
  frei um.
- Gemini kann 4K nur in der Preview-Fassung (`google/gemini-3-pro-image-preview`, Stand 10/2026).
  GPT kann höchstens 2K.
- Einzelne schwache Symbole lassen sich gezielt nachbessern: das Feld aus dem Bogen ausschneiden, als
  Eingabebild mit „ändere nur …“ schicken und das Ergebnis zurück in den Bogen setzen. Dann wieder
  `slice.mjs` ausführen.
- Im Cloud-Container nutzt Nodes `fetch` den Proxy nur mit `NODE_USE_ENV_PROXY=1`. Ohne diese Variable
  antwortet OpenRouter mit 401. Lokal wird `OPENROUTER_API_KEY` verwendet.
