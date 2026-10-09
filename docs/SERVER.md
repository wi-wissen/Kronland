# Server, Quellen und Levelpakete

Das Spiel bleibt statisch und läuft ohne Netz. Optional lädt es **Levelpakete** aus beliebigen **Quellen** (Stufe 1) und
meldet sich an einem **Server** an, um Spielstände, Fortschritt und eigene Level zu speichern (Stufe 2). Es kennt nur
Quellen, Pakete, Spielstände und einen Token – nichts von Gruppen, Klassen, Abos oder Preisen. Der Server (Laravel) ist ein
eigenes Projekt; der gemeinsame Vertrag liegt in `contract/`. Multiplayer (Relay) ist hier nicht gebaut.

| Stufe | Inhalt | Code |
|---|---|---|
| 0 | ohne Server, wie bisher (Standard: leere Konfiguration) | – |
| 1 | Quellen: Konfiguration, Kataloge, Pakete, „Level entdecken“, Einstellungen → Quellen, Seiten beim Build | `src/net/{config,catalog,packs}.js`, `src/ui/net/` |
| 2 | Server: Anmeldung (OAuth/PKCE), Cloud-Spielstände, Fortschritt, Editor „Auf Server speichern“ | `src/net/{auth,api,cloudSaves,progress,serverPacks}.js` |

## Konfiguration

`public/kronland.config.json` (kein Inhalts-Hash, der Service-Worker holt sie netzwerk-zuerst; offline gilt die letzte Kopie):

```json
{ "format": "kronland-config", "version": 1,
  "server": "https://api.kronland.example",
  "sources": ["https://beispiel.github.io/kronland-level/catalog.json"] }
```

- `server` (optional): `{server}/catalog.json` ist die **erste** Quelle, dort meldet das Spiel sich an. Nur die Datei ändert den Server.
- `sources` (optional): weitere statische Kataloge. Beide leer oder fehlend: Stufe 0, das Spiel zeigt weder „Level entdecken“ noch Konto.
- Spieler ergänzen Quellen in den **Einstellungen → Quellen** oder per Link `play/?source=<url>` (mit Rückfrage); sie liegen in `localStorage`.
  Erlaubt sind `https://` (und `http://localhost`); eine Ordneradresse wird zu `…/catalog.json`.
- Entwicklung: `play/?config=<url>` ersetzt die Datei – **nur auf localhost** (bleibt beim Spielstart in der Adresszeile).
- Ein kaputter oder fehlender Inhalt der Datei ist kein Fehler: das Spiel läuft dann in Stufe 0.

## Katalog und Pakete

Statische Quellen und Server liefern dasselbe `catalog.json` (`contract/schemas/catalog.schema.json`). Relative Adressen gelten
relativ zum Katalog. Je Eintrag: `id` (mit Herausgeber-Präfix, `wi7.adventures-2`), `title`/`summary` (de, en), `preview`,
`levels`, `minClient`, `access`, `manifest`, `sha256`.

- `access: "open"` lädt das Paket; `"locked"` zeigt ein Schloss, „Mehr erfahren“ öffnet `link` (was dort steht, weiß das Spiel nicht).
  Statische Quellen liefern nur `open`.
- Gleiche `id` in mehreren Quellen: **die zuerst konfigurierte gewinnt** (Server, dann Datei, dann Spieler). Angemeldet kommen
  die Einträge aus `GET /api/v1/packs` davor (freigeschaltete Pakete mit `manifest`, eigene mit `own: true`).
- Einzelne fehlerhafte Einträge werden übergangen, ein kaputter Katalog oder eine nicht erreichbare Quelle wird in „Level entdecken“
  gemeldet, nie als Absturz.

**`pack.json`** (`pack.schema.json`): `format`, `version`, `id`, `title`, `levels` Pflicht; `summary`, `author`, `license`
(fehlt sie, gibt es keine Lizenzangabe), `minClient`, `preview`, `media` optional. Level sind Szenario-Dateien
([Skripte](SKRIPTE.md)) mit eingebettetem Code. **Alle Dateien außer `pack.json` heißen wie ihr SHA-256** (`<hash>.json`, `<hash>.png` …) und ändern
sich nie; der Stand eines Pakets ist der SHA-256 von `pack.json`. Medien (Bilder, Tonaufnahmen, Modelle) stehen in `media`;
ein Level verweist mit `assets/<hash>.<ext>` darauf.

Das Spiel prüft beim Laden (`src/net/packs.js`): Schema, Formatnummern (neuer: „Spiel aktualisieren“, älter: „veraltet“),
`minClient` gegen die Spielversion (`package.json`), den SHA-256 jeder Datei (Web Crypto), das Szenario jedes Levels
(`validateScenario`) und die Grenzen (Level 2 MB, Mediendatei 20 MB, Modelle über 5 MB mit Hinweis). Fehler sind
Codes `packs.err.*` mit Parametern (Text in `src/i18n/net.js`). Geladene Pakete liegen in IndexedDB (`kronland-net`) und laufen
offline; nur `pack.json` wird erneut angefragt. Die Level starten wie die eingebauten Programmier-Abenteuer
(`App.openLevel` → `scenarioToDef`), erledigte Level bekommen auf dem Gerät ein Häkchen.

Die Dateien eines Pakets liegen neben `pack.json`. Beim Server-Endpunkt `…/api/v1/packs/{id}/manifest` liegen sie unter
`…/api/v1/packs/{id}/files/<name>` (der Server darf auf signierte Adressen umleiten; das Manifest bleibt unverändert, sonst
änderte sich sein Hash).

## Quelle auf GitHub Pages veröffentlichen

1. Level im Welteneditor bauen und als `.zip` speichern („Speichern“).
2. Paket und Katalog erzeugen (legt Hash-Dateien und `catalog.json` an, ein weiterer Aufruf ergänzt/ersetzt das Paket):
   ```bash
   node scripts/build-pack.mjs --id meinname.erste-level --title "Meine Level|My levels" \
        --license CC-BY-4.0 --out ../kronland-level level1.zip level2.zip
   ```
3. `../kronland-level` ist ein Git-Repository mit GitHub Pages (Branch `main`, Ordner `/`); die Adresse
   `https://<name>.github.io/kronland-level/catalog.json` ist die Quelle. Pages sendet `Access-Control-Allow-Origin: *`, eigene Hosts müssen es auch senden.
4. Eintragen: in `public/kronland.config.json` unter `sources` (Betreiber) oder als Link `play/?source=<Adresse>` (Spieler).

## Build: Seiten für Pakete

Steht in der Konfiguration ein `server` oder `sources`, lädt `scripts/vite-pack-pages.js` beim `npm run build` alle Kataloge und
schreibt je **offenem** Paket `level/<id>/index.html` (Titel, Beschreibung, Vorschau, Link `play/?play=<id>`, Linkvorschau) und
`sitemap-levels.xml`. Nicht erreichbare oder fehlerhafte Quellen werden mit Warnung übersprungen, der Build schlägt deswegen
nie fehl. Ohne Quellen (Standard) passiert nichts. `sitemap-levels.xml` muss in eine `robots.txt` oder Sitemap-Übersicht eingetragen werden, falls es dort eine gibt.

## Anmeldung (OAuth 2 mit PKCE)

`src/net/auth.js`, eigener Code auf Web Crypto, öffentlicher Client `kronland-game` ohne Geheimnis, Scopes `play packs:write`:

1. „Anmelden“ im Startmenü: zufälliger `code_verifier` und `state` in `sessionStorage`, Weiterleitung zu
   `{server}/oauth/authorize?response_type=code&client_id=kronland-game&redirect_uri=<Spielseite>&code_challenge=<SHA-256>&code_challenge_method=S256&state=…`.
2. Zurück auf der Spielseite mit `?code=&state=`: der `state` muss passen, dann `POST {server}/oauth/token` (Code + Verifier), Tokens in IndexedDB,
   die Adresse wird bereinigt (ein mitgegebener Start-Link bleibt).
3. Der Zugriffstoken wird kurz vor Ablauf per Refresh-Token erneuert (parallele Anfragen teilen eine Erneuerung); lehnt der Server den Refresh-Token ab, endet die Sitzung.
4. „Abmelden“ löscht die Tokens sofort auf dem Gerät (auch offline oder bei Fehlern) und widerruft sie nach RFC 7009:
   `POST {server}/oauth/revoke` mit `token=<refresh_token>&token_type_hint=refresh_token&client_id=kronland-game`
   (ohne Refresh-Token: der Zugriffstoken mit `access_token`). Timeout 5 s; ein fehlgeschlagener Widerruf wird nur
   mit `console.warn` protokolliert und blockiert nie. Tokens gelten nur für den konfigurierten Server.
   Der Server muss beim Widerruf des Refresh-Tokens die ganze Berechtigung beenden (Zugriffstoken und Refresh-Token
   desselben Grants) und auch bei unbekannten oder schon ungültigen Tokens mit 200 und leerem Body antworten;
   Fehler als `{"error":"invalid_request"}` bzw. `unsupported_token_type` (400). Der Client speichert bei jeder
   Erneuerung den neuesten Refresh-Token (Rotation).
   Laravel Passport hat keinen RFC-7009-Endpunkt: der Server braucht eine kleine Route, die den Token anhand von
   `token` findet und über `TokenRepository::revokeAccessToken()` bzw. `RefreshTokenRepository::revokeRefreshTokensByAccessTokenId()`
   den Zugriffstoken samt Refresh-Tokens widerruft.

Angemeldet zeigt das Startmenü „Angemeldet als <Name>“ und „Konto verwalten“ (öffnet `accountUrl` aus `GET /api/v1/me`).
Der Redirect-URI ist die Spielseite ohne Query (`…/play/`), am Server für den Client zu registrieren (plus `http://localhost:<Port>/play/` für die Entwicklung).

## Was das Spiel vom Server nutzt

Vollständig in `contract/openapi.yaml`, Formate in `contract/schemas/`, Version in `contract/VERSION`.

| Endpunkt | Nutzung im Spiel |
|---|---|
| `GET /catalog.json` | erste Quelle (öffentliche Pakete) |
| `GET /oauth/authorize`, `POST /oauth/token` | Anmeldung, Erneuern |
| `GET /api/v1/me` | `{ displayName, accountUrl }` |
| `GET /api/v1/packs` | Katalogeinträge für mich (freigeschaltet mit `manifest`, eigene mit `own`) |
| `GET /api/v1/packs/{id}/manifest`, `…/files/{name}` | Paket laden (unlisted ohne Token, private mit) |
| `GET PUT DELETE /api/v1/packs/{id}`, `POST …/media` | Editor: „Auf Server speichern“, eigene Pakete öffnen/löschen |
| `GET POST /api/v1/saves`, `GET PUT DELETE /api/v1/saves/{id}` | Cloud-Spielstände (`If-Match`, `?save=` mit Signatur) |
| `POST /api/v1/progress` | Fortschrittsereignisse |
| `POST /broadcasting/auth` | Relay-Freigabe (Stufe 3, noch nicht genutzt) |

Fehler: `{ "error": { "code": "packs.err.schema", "params": { "path": "/levels/0/id" } } }`; `code` ist ein i18n-Schlüssel des Spiels,
unbekannte Codes zeigt es als „Unerwarteter Fehler (<code>)“.

- **Cloud-Spielstände** (`cloudSaves.js`): ein weiteres Backend für `src/save` (`SaveStore` unverändert). Angemeldet schaltet die
  Spielstandliste zwischen „Auf diesem Gerät“ und „Cloud“. Überschreiben nimmt den zuletzt gesehenen ETag als `If-Match`; ein
  inzwischen geänderter Stand gibt `saves.err.conflict`. Der Autospeicher bleibt lokal. Die Server-Schreibanfrage ist `{ envelope, thumb? }`
  (`thumb` fehlt = Vorschau behalten), `GET` liefert den Umschlag unverändert.
- **`?save=<url>`**: öffnet einen Spielstand des konfigurierten Servers. Ist er nicht in der eigenen Liste (z. B. signierte Adresse einer Lehrkraft), ist er **schreibgeschützt**:
  kein Speichern, kein Autospeichern.
- **`?play=<id>`**: öffnet „Level entdecken“ mit dem Paket (aus den Katalogen, sonst vom Server über sein Manifest, z. B. ein unlisted Link).
- **Fortschritt** (`progress.js`): für Level aus Paketen, solange angemeldet: `started` (Levelstart), `run` („Ausführen“ im Code-Panel),
  `completed`/`failed` (Ende) mit `attempts`, `seconds`, `packHash` und den bearbeitbaren Code-Abschnitten (zusammen ≤ 64 KB, längster wird gekürzt).
  Ereignisse haben eine UUID und werden in IndexedDB gepuffert (≤ 500), gesendet in Paketen zu 50, wiederholt bei Netzfehler; der Server lehnt Unbrauchbares mit 422 ab (dann verworfen).
  Die Simulation weiß davon nichts: Haken sind `Engine.onRun` und der Missionsausgang in `App.vue`.
- **Editor**: „Auf Server speichern“ (nur angemeldet) macht aus dem Level ein Paket mit einem Level: benutzte Medien werden nach SHA-256 umbenannt,
  hochgeladen (`POST …/media`), dann `PUT /api/v1/packs/{id}` (neues Paket: kurze Zufalls-ID, privat). Eigene Pakete erscheinen unter „Level entdecken“
  mit „Im Editor öffnen“ und „Löschen“.

## Mock-Server und Tests

```bash
node scripts/mock-server.mjs --port 4400 --game http://localhost:5173/play/
npm run dev        # in einem zweiten Terminal
# Spiel: http://localhost:5173/play/?config=http://localhost:4400/kronland.config.json
```

Der Mock-Server (`scripts/mock-server.mjs`, Node ohne Abhängigkeiten, alles im Speicher) liefert die Fixtures aus `contract/fixtures/`:
`/catalog.json` (Server-Katalog mit gesperrtem Paket), `/static/catalog.json` (statische Quelle), das Beispielpaket mit den fünf Lernabenteuern,
eine Anmeldeseite mit dem Knopf „Als Test anmelden“ (**PKCE wird wirklich geprüft**: S256, Code einmalig, Redirect-URI), Token-Erneuerung mit Rotation,
Spielstände (ETag/`If-Match`, signierte Adressen über `/mock/signed/<id>`), eigene Pakete (Medien, Manifest, Dateien), Fortschritt (`/mock/progress`),
CORS und `/play/<id>` (Weiterleitung ins Spiel). `/mock/reset` setzt die Daten zurück, `/mock/revoke` entwertet die Zugriffstoken.

- Beispielpaket neu erzeugen (aus den eingebauten Abenteuern): `node contract/build-fixtures.mjs`; `tests/net/packs.test.js` prüft, dass es aktuell ist.
- Vitest: `npx vitest run tests/net` (Konfiguration, Kataloge, Hash/`minClient`, PKCE, API-Fehler, Fortschrittspuffer, Cloud-Konflikt, Mock-Server gegen die Schemas, Paketbau, Build-Seiten).
- Playwright: `E2E_PORT=4312 npx playwright test e2e/server.spec.js --workers=1` (Desktop; startet den Mock-Server selbst, ersetzt die Konfigurationsdatei je Test).
  Bilder: `E2E_SHOT_DIR=<ordner> E2E_SHOT_SIZE=1440x900` bzw. `412x915`.
- Der Server (Pest) soll seine Antworten gegen `contract/openapi.yaml` prüfen und die Vertragsversion (`contract/VERSION`) pinnen.

## JSON-Schema-Prüfung im Spiel

`src/net/schema.js` ist ein eigener Prüfer für die kleine Teilmenge von JSON Schema, die der Vertrag nutzt (rund 80 Zeilen, läuft im Browser und in Node).
Ajv hätte ein Vielfaches des ganzen Netzcodes gekostet und kompiliert mit `new Function` (von strengen Content-Security-Policies verboten).
Fehler tragen einen JSON-Pointer (`/levels/0/file`), der als `path` in `packs.err.schema` landet.

## Offen

Multiplayer/Relay (Stufe 3); Folgelevel eines Pakets nach dem Sieg
(`next`) gibt es nicht, das Spiel kehrt zu „Level entdecken“ zurück.
