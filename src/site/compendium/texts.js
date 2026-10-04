// Compendium texts: column headers, field names and introductions per section (Markdown, see ../markdown.js).
// The numbers themselves are NOT here – they come from the game data (generate.js). Unknown data fields
// appear with their key so that new content stays visible; they can then be given a name here.

export const LABELS = {
  de: {
    // Sections
    'sec.buildings': 'Gebäude', 'sec.units': 'Einheiten', 'sec.heroes': 'Helden', 'sec.techs': 'Technologien',
    'sec.resources': 'Rohstoffe & Veredelung', 'sec.economy': 'Motivation, Steuern, Zahltag', 'sec.weather': 'Wetter',
    'sec.experience': 'Erfahrung', 'sec.damage': 'Brand & Reparatur', 'sec.market': 'Marktplatz', 'sec.vision': 'Sicht & Nebel',
    'sec.ai': 'Computergegner', 'sec.mapgen': 'Kartengenerator',
    // Columns
    'col.name': 'Name', 'col.level': 'Stufe', 'col.size': 'Größe', 'col.placement': 'Platzierung', 'col.levels': 'Stufen',
    'col.requires': 'Voraussetzung', 'col.cost': 'Kosten', 'col.buildTime': 'Bauzeit', 'col.hp': 'LP', 'col.workers': 'Arbeiter',
    'col.upgradeReq': 'Ausbau braucht', 'col.sight': 'Sicht', 'col.armor': 'Rüstung', 'col.attack': 'Angriff',
    'col.tier': 'Stufe', 'col.soldierHp': 'LP Soldat', 'col.soldiers': 'Soldaten', 'col.attackType': 'Angriffsart',
    'col.armorType': 'Rüstungsart', 'col.range': 'Reichweite', 'col.cooldown': 'Abklingzeit', 'col.speed': 'Tempo',
    'col.pop': 'Bev.', 'col.leaderCost': 'Hauptmann', 'col.soldierCost': 'je Soldat', 'col.fullCost': 'volle Einheit',
    'col.upgradeCost': 'Aufwerten', 'col.building': 'Gebäude', 'col.line': 'Linie', 'col.time': 'Zeit',
    'col.points': 'Forschungspunkte', 'col.prev': 'Vorgänger', 'col.unlocks': 'Schaltet frei', 'col.effect': 'Wirkung',
    'col.minLevel': 'ab Gebäudestufe', 'col.resource': 'Rohstoff', 'col.start': 'Start (Normal)', 'col.price': 'Grundpreis',
    'col.source': 'Gewinnung', 'col.refiner': 'Veredler', 'col.profession': 'Beruf', 'col.kind': 'Art', 'col.cycle': 'Arbeitsgang',
    'col.yield': 'Ertrag', 'col.perMin': 'je Minute (max.)', 'col.professions': 'Berufe', 'col.value': 'Wert', 'col.meaning': 'Bedeutung',
    'col.taxLevel': 'Steuersatz', 'col.goldPerWorker': 'Taler je Arbeiter', 'col.motivation': 'Motivation je Zahltag',
    'col.state': 'Wetter', 'col.duration': 'Dauer', 'col.startsAt': 'beginnt nach', 'col.stars': 'Sterne', 'col.rank': 'Rang',
    'col.hits': 'Treffer nötig', 'col.amount': 'Menge', 'col.buy': '{n} kaufen: Taler', 'col.sell': '{n} Taler kosten',
    'col.source2': 'Sichtquelle', 'col.ability': 'Fähigkeit', 'col.description': 'Beschreibung', 'col.params': 'Werte',
    'col.difficulty': 'Stärke', 'col.key': 'Eigenschaft', 'col.vs': 'gegen', 'col.attacker': 'Angreifer',
    'col.order': 'Reihenfolge', 'col.count': 'Anzahl', 'col.percent': 'Faktor',
    // Field names
    'f.size': 'Größe', 'f.placement': 'Platzierung', 'f.armor': 'Rüstung', 'f.requires': 'Voraussetzung', 'f.profession': 'Beruf',
    'f.motivationEffect': 'Motivation (Höchstwert und einmalig)', 'f.notBuildable': 'Nicht baubar', 'f.shaftResource': 'Schacht',
    'f.research': 'Forschung hier', 'f.trains': 'Bildet aus', 'f.towerAttack': 'Turmangriff', 'f.refiner': 'Veredler für Stufe 2',
    'f.building': 'Ausgebildet in', 'f.title': 'Titel', 'f.revive': 'Wiederbelebung',
    'place.free': 'frei', 'place.settlement': 'Siedlungsplatz', 'place.shaft': 'Schacht',
    'kind.none': 'zahlt nur Steuern', 'kind.mine': 'fördert Rohware', 'kind.refine': 'veredelt', 'kind.gold': 'prägt Taler',
    'kind.faith': 'erzeugt Glauben', 'kind.research': 'forscht', 'kind.energy': 'Wetterenergie',
    'target.units': 'Truppen', 'target.serfs': 'Leibeigene', 'target.workers': 'Arbeiter', 'target.militia': 'Miliz',
    'target.buildings': 'Gebäude', 'target.leaders': 'alle Hauptleute',
    'eff.attack': 'Angriff', 'eff.armor': 'Rüstung', 'eff.range': 'Reichweite', 'eff.speed': 'Tempo', 'eff.sight': 'Sicht',
    'eff.hpPercent': 'Lebenspunkte',
    'atk.pierce': 'Stich', 'atk.slash': 'Schlag', 'atk.shot': 'Schuss', 'atk.chaos': 'Chaos', 'atk.siege': 'Belagerung', 'atk.hero': 'Held',
    'arm.none': 'keine', 'arm.padded': 'gepolstert', 'arm.leather': 'Leder', 'arm.iron': 'Eisen', 'arm.fortified': 'befestigt (Gebäude)', 'arm.hero': 'Held',
    'u.tiles': '{n} Kacheln', 'u.tilesS': '{n} Kacheln/s', 'u.s': '{n} s', 'u.min': '{n} min', 'u.pct': '{n} %', 'u.perS': '{n}/s',
    'yes': 'ja', 'no': 'nein', 'none': '–', 'fortress': 'Festung', 'and': 'und', 'level': 'Stufe {n}',
    'unlock.building': 'Gebäude', 'unlock.upgrade': 'Ausbau', 'unlock.tax': 'Steuersatz wählbar',
    'tierReq': 'Stufe {n} der Linie', 'tierReq.2': 'Festung (Burg Stufe 2)', 'tierReq.3': 'Universität (Hochschule Stufe 2)',
    'tierReq.4': 'Universität (Hochschule Stufe 2)', 'univ4': '4 Hochschul-Technologien erforscht',
    'line.req.1': 'Militärgebäude', 'line.req.2.refiner': '{b} (fertig)', 'line.req.2.upgrade': '{b} ausgebaut',
    'line.req.3': '{b} ausgebaut', 'line.req.4': 'zusätzlich Festung',
    'vs.building': 'Gebäude (befestigt, Rüstung {n})', 'vs.hero': 'Held',
    'src.serfs': 'Leibeigene (Haufen)', 'src.trees': 'Leibeigene fällen Bäume', 'src.tax': 'Steuern am Zahltag',
    'diff.easy': 'Leicht', 'diff.normal': 'Normal', 'diff.hard': 'Schwer',
    'map.size': 'Kartengröße', 'map.seed': 'Kartennummer', 'map.players': 'Spieler', 'map.render': 'Vorschau',
    'map.trees': 'Bäume', 'map.piles': 'Rohstoffhaufen', 'map.shafts': 'Schächte', 'map.spots': 'Siedlungsplätze',
    'map.water': 'Wasser', 'map.cliff': 'Fels/Gipfel', 'map.start': 'Startposition', 'map.legend': 'Legende',
    'map.small': 'klein', 'map.medium': 'mittel', 'map.large': 'groß', 'map.show': 'Erzeugen',
    'col.population': 'Bevölkerung',
    'ab.duration': 'Dauer', 'ab.radius': 'Radius', 'ab.damage': 'Schaden', 'ab.amount': 'Heilung (LP)', 'ab.attackPercent': 'Angriff', 'ab.hp': 'LP', 'ab.attack': 'Angriff', 'ab.range': 'Reichweite', 'ab.shots': 'Schüsse', 'ab.fuse': 'Lunte',
    'cap.combat': 'Kampfwerte', 'cap.xp': 'Erfahrungswerte', 'cap.damage': 'Werte', 'cap.market': 'Marktwerte', 'cap.vision': 'Sichtberechnung', 'cap.mapgen': 'Generator',
    'ai.buildPlan': 'Bauplan', 'ai.research': 'Forschungsreihenfolge', 'ai.buildingResearch': 'Gebäude-Technologien',
    'sec.slope': 'Bauen am Hang', 'col.ranged': 'Fernkampf', 'col.water': 'Wasser', 'water.frozen': 'gefroren, begehbar',
    'col.slope': 'Höhenunterschied unter der Fläche', 'col.preview': 'Bauvorschau', 'col.result': 'Ergebnis',
    'slope.flat': 'grün – eben', 'slope.flatR': 'Bau ohne Erdarbeiten',
    'slope.level': 'gelb – wird eingeebnet', 'slope.levelR': 'Fläche auf den Mittelwert eingeebnet, Rand angeglichen',
    'slope.steep': 'rot – zu steil', 'slope.steepR': 'Bau abgelehnt („Gelände zu steil“)',
    'slope.before': 'Beispiel: {b} ({w} × {h}) auf einer Rampe – Höhen in cm vorher (Grundfläche hervorgehoben)',
    'slope.after': 'Nach dem Setzen der Baustelle: Grundfläche auf {t} cm, Rand halb bzw. (Ecken) ein Viertel angeglichen',
  },
  en: {
    'sec.buildings': 'Buildings', 'sec.units': 'Units', 'sec.heroes': 'Heroes', 'sec.techs': 'Technologies',
    'sec.resources': 'Resources & refining', 'sec.economy': 'Motivation, taxes, payday', 'sec.weather': 'Weather',
    'sec.experience': 'Experience', 'sec.damage': 'Fire & repair', 'sec.market': 'Marketplace', 'sec.vision': 'Sight & fog',
    'sec.ai': 'Computer opponents', 'sec.mapgen': 'Map generator',
    'col.name': 'Name', 'col.level': 'Level', 'col.size': 'Size', 'col.placement': 'Placement', 'col.levels': 'Levels',
    'col.requires': 'Requires', 'col.cost': 'Cost', 'col.buildTime': 'Build time', 'col.hp': 'HP', 'col.workers': 'Workers',
    'col.upgradeReq': 'Upgrade needs', 'col.sight': 'Sight', 'col.armor': 'Armour', 'col.attack': 'Attack',
    'col.tier': 'Tier', 'col.soldierHp': 'Soldier HP', 'col.soldiers': 'Soldiers', 'col.attackType': 'Attack type',
    'col.armorType': 'Armour type', 'col.range': 'Range', 'col.cooldown': 'Cooldown', 'col.speed': 'Speed',
    'col.pop': 'Pop.', 'col.leaderCost': 'Captain', 'col.soldierCost': 'per soldier', 'col.fullCost': 'full unit',
    'col.upgradeCost': 'Upgrade', 'col.building': 'Building', 'col.line': 'Line', 'col.time': 'Time',
    'col.points': 'Research points', 'col.prev': 'Predecessor', 'col.unlocks': 'Unlocks', 'col.effect': 'Effect',
    'col.minLevel': 'from building level', 'col.resource': 'Resource', 'col.start': 'Start (Normal)', 'col.price': 'Base price',
    'col.source': 'Source', 'col.refiner': 'Refiner', 'col.profession': 'Profession', 'col.kind': 'Kind', 'col.cycle': 'Work cycle',
    'col.yield': 'Yield', 'col.perMin': 'per minute (max.)', 'col.professions': 'Professions', 'col.value': 'Value', 'col.meaning': 'Meaning',
    'col.taxLevel': 'Tax rate', 'col.goldPerWorker': 'Thalers per worker', 'col.motivation': 'Motivation per payday',
    'col.state': 'Weather', 'col.duration': 'Duration', 'col.startsAt': 'starts after', 'col.stars': 'Stars', 'col.rank': 'Rank',
    'col.hits': 'Hits needed', 'col.amount': 'Amount', 'col.buy': 'buy {n}: thalers', 'col.sell': '{n} thalers cost',
    'col.source2': 'Sight source', 'col.ability': 'Ability', 'col.description': 'Description', 'col.params': 'Values',
    'col.difficulty': 'Strength', 'col.key': 'Property', 'col.vs': 'vs.', 'col.attacker': 'Attacker',
    'col.order': 'Order', 'col.count': 'Count', 'col.percent': 'Factor',
    'f.size': 'Size', 'f.placement': 'Placement', 'f.armor': 'Armour', 'f.requires': 'Requires', 'f.profession': 'Profession',
    'f.motivationEffect': 'Motivation (maximum and once)', 'f.notBuildable': 'Not buildable', 'f.shaftResource': 'Shaft',
    'f.research': 'Research here', 'f.trains': 'Trains', 'f.towerAttack': 'Tower attack', 'f.refiner': 'Refiner for tier 2',
    'f.building': 'Trained at', 'f.title': 'Title', 'f.revive': 'Revival',
    'place.free': 'free', 'place.settlement': 'settlement spot', 'place.shaft': 'shaft',
    'kind.none': 'only pays taxes', 'kind.mine': 'mines raw goods', 'kind.refine': 'refines', 'kind.gold': 'mints thalers',
    'kind.faith': 'generates faith', 'kind.research': 'researches', 'kind.energy': 'weather energy',
    'target.units': 'Troops', 'target.serfs': 'Serfs', 'target.workers': 'Workers', 'target.militia': 'Militia',
    'target.buildings': 'Buildings', 'target.leaders': 'all captains',
    'eff.attack': 'Attack', 'eff.armor': 'Armour', 'eff.range': 'Range', 'eff.speed': 'Speed', 'eff.sight': 'Sight',
    'eff.hpPercent': 'Hit points',
    'atk.pierce': 'Pierce', 'atk.slash': 'Slash', 'atk.shot': 'Shot', 'atk.chaos': 'Chaos', 'atk.siege': 'Siege', 'atk.hero': 'Hero',
    'arm.none': 'none', 'arm.padded': 'padded', 'arm.leather': 'leather', 'arm.iron': 'iron', 'arm.fortified': 'fortified (buildings)', 'arm.hero': 'hero',
    'u.tiles': '{n} tiles', 'u.tilesS': '{n} tiles/s', 'u.s': '{n} s', 'u.min': '{n} min', 'u.pct': '{n} %', 'u.perS': '{n}/s',
    'yes': 'yes', 'no': 'no', 'none': '–', 'fortress': 'Fortress', 'and': 'and', 'level': 'Level {n}',
    'unlock.building': 'Building', 'unlock.upgrade': 'Upgrade', 'unlock.tax': 'tax rate selectable',
    'tierReq': 'Tier {n} of the line', 'tierReq.2': 'Fortress (castle level 2)', 'tierReq.3': 'University (college level 2)',
    'tierReq.4': 'University (college level 2)', 'univ4': '4 college technologies researched',
    'line.req.1': 'military building', 'line.req.2.refiner': '{b} (finished)', 'line.req.2.upgrade': '{b} upgraded',
    'line.req.3': '{b} upgraded', 'line.req.4': 'plus Fortress',
    'vs.building': 'Building (fortified, armour {n})', 'vs.hero': 'Hero',
    'src.serfs': 'Serfs (piles)', 'src.trees': 'Serfs fell trees', 'src.tax': 'Taxes on payday',
    'diff.easy': 'Easy', 'diff.normal': 'Normal', 'diff.hard': 'Hard',
    'map.size': 'Map size', 'map.seed': 'Map number', 'map.players': 'Players', 'map.render': 'Preview',
    'map.trees': 'Trees', 'map.piles': 'Resource piles', 'map.shafts': 'Shafts', 'map.spots': 'Settlement spots',
    'map.water': 'Water', 'map.cliff': 'Rock/peak', 'map.start': 'Start position', 'map.legend': 'Legend',
    'map.small': 'small', 'map.medium': 'medium', 'map.large': 'large', 'map.show': 'Generate',
    'col.population': 'Population',
    'ab.duration': 'Duration', 'ab.radius': 'Radius', 'ab.damage': 'Damage', 'ab.amount': 'Healing (HP)', 'ab.attackPercent': 'Attack', 'ab.hp': 'HP', 'ab.attack': 'Attack', 'ab.range': 'Range', 'ab.shots': 'Shots', 'ab.fuse': 'Fuse',
    'cap.combat': 'Combat values', 'cap.xp': 'Experience values', 'cap.damage': 'Values', 'cap.market': 'Market values', 'cap.vision': 'Sight computation', 'cap.mapgen': 'Generator',
    'ai.buildPlan': 'Build plan', 'ai.research': 'Research order', 'ai.buildingResearch': 'Building technologies',
    'sec.slope': 'Building on slopes', 'col.ranged': 'Ranged', 'col.water': 'Water', 'water.frozen': 'frozen, walkable',
    'col.slope': 'Height difference under the footprint', 'col.preview': 'Placement preview', 'col.result': 'Result',
    'slope.flat': 'green – level', 'slope.flatR': 'built without earthworks',
    'slope.level': 'yellow – will be levelled', 'slope.levelR': 'footprint levelled to the mean, border blended',
    'slope.steep': 'red – too steep', 'slope.steepR': 'placement refused (“terrain too steep”)',
    'slope.before': 'Example: {b} ({w} × {h}) on a ramp – heights in cm before (footprint highlighted)',
    'slope.after': 'After placing the site: footprint at {t} cm, border moved half way (corners a quarter)',
  },
};

/** Explanations of constants (keys from the data objects). If one is missing, the key is shown. */
export const KEYS = {
  de: {
    // WORKER
    speed: 'Lauftempo (Milli-Kacheln je Takt)', maxStamina: 'Ausdauer maximal', cycleCost: 'Ausdauer je Arbeitsgang',
    eatGain: 'Ausdauer durch Essen (× Motivationswirkung)', sleepGain: 'Ausdauer durch Schlafen (× Motivationswirkung)', campGain: 'Ausdauer am Lagerfeuer (fest)', startStamina: 'Ausdauer neuer Arbeiter',
    eatTicks: 'Essensdauer (Takte)', sleepTicks: 'Schlafdauer (Takte)', campTicks: 'Rast am Lagerfeuer (Takte)', fetchAmount: 'Rohware je Gang (Veredler)',
    maxDistance: 'größte Entfernung Arbeitsplatz → Haus/Hof (Kacheln)', spawnTicks: 'neuer Arbeiter je Dorfzentrum alle … Takte',
    startMotivation: 'Motivation zu Beginn (%)', baseMaxMotivation: 'Höchstwert ohne Ziergebäude (%)', hardMaxMotivation: 'absoluter Höchstwert (%)',
    leaveBelow: 'Arbeiter wandert ab unter (%)', noNewSettlersBelow: 'keine neuen Siedler unter Ø (%)', overtimeSpeedPercent: 'Überstunden: Tempo (%)',
    overtimeMotivation: 'Überstunden: Motivation je Arbeitsgang', blessingFaith: 'Glaube je Segnung', blessingMotivation: 'Segnung: Motivation (+ %)',
    // DIFFICULTY
    think: 'Bedenkzeit', serfs: 'Ziel Leibeigene', attackSize: 'Hauptleute je Angriff', firstAttack: 'frühester Angriff',
    maxSites: 'gleichzeitige Baustellen', bonusGold: 'Start-Bonus Taler', reserve: 'Rücklage Taler', militaryShare: 'Anteil Militär (%)',
    intel: 'Wachen melden Feinde im Nebel', name: 'Name',
    // COMBAT / DAMAGE / MARKET / WEATHER_CONTROL / EXPERIENCE / VISION
    sight: 'Kampfsicht (Kacheln)', leash: 'max. Verfolgung vom Ankerpunkt (Kacheln)', meleeRange: 'Nahkampfreichweite (Milli-Kacheln)',
    heroReviveTicks: 'Held steht auf nach (Takte ohne Feinde)', heroReviveRadius: '… im Umkreis (Kacheln)', gridCell: 'Suchraster (Kacheln)',
    burnBelowPercent: 'brennt unter (% LP)', burnTicks: 'Brandschaden alle … Takte', burnHp: 'LP Verlust je Brandschritt',
    repairHpPerTick: 'Reparatur je Leibeigenem und Takt (LP)', ruinTicks: 'Ruine bleibt (Takte)', decayTicks: 'Zerfall ausgeschiedener Spieler (Takte)',
    step: 'Handelsschritt', maxAmount: 'höchstens je Handel', changePercent: 'Preisänderung je Schritt (% Grundwert)',
    minPercent: 'Preisgrenze unten (% Grundwert)', maxPercent: 'Preisgrenze oben (% Grundwert)', recoverTicks: 'Preiserholung alle … Takte',
    recoverPercent: '… um (% Grundwert)', pointsPer50: 'Arbeitspunkte je 50 Einheiten',
    maxEnergy: 'Energiespeicher', changeCost: 'Energie je Wetterwechsel', duration: 'herbeigeführtes Wetter hält (Takte)',
    cooldown: 'Sperre bis zum nächsten Wechsel (Takte)', forecastCount: 'Vorhersage: Anzahl Wetterlagen',
    critPercent: '1 ★: Chance kritischer Treffer (%)', rangeBonus: '2 ★: Reichweite Fernkampf (Milli-Kacheln)', sightBonus: '2 ★: Sicht (Kacheln)',
    regenTicks: '3 ★: Heilung alle … Takte', regenHp: '3 ★: LP je Heilung', attackBonus: '4 ★: Angriff', rangedAttackBonus: '5 ★: Angriff Fernkampf',
    meleeArmorBonus: '5 ★: Rüstung Nahkampf',
    updateTicks: 'Sicht neu berechnet alle … Takte', startReveal: 'erkundet um jede Burg (Kacheln)', minRadius: 'Sicht mindestens (Kacheln)',
    building: 'übrige Gebäude', site: 'Baustelle',
    // BALANCE.serf
    hp: 'Lebenspunkte', attack: 'Angriff', armor: 'Rüstung', maxBuildersPerSite: 'Bauarbeiter je Baustelle', chopTicks: 'Hieb-Zyklus Holz (Takte)',
    chopYield: 'Holz je Zyklus', mineTicks: 'Abbau-Zyklus Haufen (Takte)', mineYield: 'Rohstoff je Zyklus', searchRadius: 'Umkreis für Anschlussarbeit (Kacheln)',
    // Hero abilities
    WATER_PERCENT: 'Wasseranteil im Flachland (%)', CLIFF_SLOPE: 'Klippe ab Höhenunterschied je Kachel (cm)', PEAK_HEIGHT: 'Gipfel ab Höhe über Wasser (cm)',
    radius: 'Radius', damage: 'Schaden', amount: 'Heilung (LP)', attackPercent: 'Angriff (%)', fuse: 'Lunte', shots: 'Schüsse', range: 'Reichweite',
  },
  en: {
    speed: 'Walking speed (milli-tiles per tick)', maxStamina: 'Maximum stamina', cycleCost: 'Stamina per work cycle',
    eatGain: 'Stamina from eating (× motivation effect)', sleepGain: 'Stamina from sleeping (× motivation effect)', campGain: 'Stamina at the campfire (fixed)', startStamina: 'Stamina of new workers',
    eatTicks: 'Eating time (ticks)', sleepTicks: 'Sleeping time (ticks)', campTicks: 'Rest at the campfire (ticks)', fetchAmount: 'Raw goods per trip (refiners)',
    maxDistance: 'Max. distance workplace → house/farm (tiles)', spawnTicks: 'New worker per village centre every … ticks',
    startMotivation: 'Starting motivation (%)', baseMaxMotivation: 'Maximum without ornaments (%)', hardMaxMotivation: 'Absolute maximum (%)',
    leaveBelow: 'Worker leaves below (%)', noNewSettlersBelow: 'No new settlers below average (%)', overtimeSpeedPercent: 'Overtime: speed (%)',
    overtimeMotivation: 'Overtime: motivation per cycle', blessingFaith: 'Faith per blessing', blessingMotivation: 'Blessing: motivation (+ %)',
    think: 'Thinking interval', serfs: 'Target serfs', attackSize: 'Captains per attack', firstAttack: 'Earliest attack',
    maxSites: 'Simultaneous building sites', bonusGold: 'Starting bonus thalers', reserve: 'Thaler reserve', militaryShare: 'Military share (%)',
    intel: 'Guards report enemies in the fog', name: 'Name',
    sight: 'Combat sight (tiles)', leash: 'Max. pursuit from anchor (tiles)', meleeRange: 'Melee range (milli-tiles)',
    heroReviveTicks: 'Hero rises after (ticks without enemies)', heroReviveRadius: '… within (tiles)', gridCell: 'Search grid (tiles)',
    burnBelowPercent: 'Burns below (% HP)', burnTicks: 'Fire damage every … ticks', burnHp: 'HP lost per fire step',
    repairHpPerTick: 'Repair per serf and tick (HP)', ruinTicks: 'Ruin remains (ticks)', decayTicks: 'Decay of defeated players (ticks)',
    step: 'Trade step', maxAmount: 'Max. per trade', changePercent: 'Price change per step (% of base)',
    minPercent: 'Lower price limit (% of base)', maxPercent: 'Upper price limit (% of base)', recoverTicks: 'Price recovers every … ticks',
    recoverPercent: '… by (% of base)', pointsPer50: 'Work points per 50 units',
    maxEnergy: 'Energy storage', changeCost: 'Energy per weather change', duration: 'Induced weather lasts (ticks)',
    cooldown: 'Lockout until next change (ticks)', forecastCount: 'Forecast: number of weather periods',
    critPercent: '1 ★: critical hit chance (%)', rangeBonus: '2 ★: ranged range (milli-tiles)', sightBonus: '2 ★: sight (tiles)',
    regenTicks: '3 ★: heal every … ticks', regenHp: '3 ★: HP per heal', attackBonus: '4 ★: attack', rangedAttackBonus: '5 ★: ranged attack',
    meleeArmorBonus: '5 ★: melee armour',
    updateTicks: 'Sight recomputed every … ticks', startReveal: 'Explored around each castle (tiles)', minRadius: 'Minimum sight (tiles)',
    building: 'other buildings', site: 'building site',
    hp: 'Hit points', attack: 'Attack', armor: 'Armour', maxBuildersPerSite: 'Builders per site', chopTicks: 'Wood chopping cycle (ticks)',
    chopYield: 'Wood per cycle', mineTicks: 'Pile mining cycle (ticks)', mineYield: 'Resource per cycle', searchRadius: 'Radius for follow-up work (tiles)',
    WATER_PERCENT: 'Water share in lowlands (%)', CLIFF_SLOPE: 'Cliff from height difference per tile (cm)', PEAK_HEIGHT: 'Peak from height above water (cm)',
    radius: 'Radius', damage: 'Damage', amount: 'Healing (HP)', attackPercent: 'Attack (%)', fuse: 'Fuse', shots: 'Shots', range: 'Range',
  },
};

/** Introductions per section (Markdown). Placeholders {{…}} are filled by generate.js from the data. */
export const INTROS = {
  de: {
    buildings: `Alle Gebäude mit Kosten je Ausbaustufe. **Bauzeit** gilt bei {{builders}} Leibeigenen; mit weniger dauert es entsprechend länger.
Gebaut wird frei, auch am Hang (Höhenunterschied unter dem Gebäude höchstens {{maxSlope}} cm, siehe [Bauen am Hang](#slope)), Dorfzentren nur auf Siedlungsplätzen,
Minen nur auf Schächten. Abriss erstattet die Hälfte der Baukosten. Rüstung: Burg {{hqArmor}}, sonst wie angegeben (Standard 3).`,
    units: `Truppen bestehen aus einem **Hauptmann** und seinen **Soldaten**. Angriff, Rüstung und LP in der Tabelle gelten für den Hauptmann;
der Hauptmann ist unverwundbar, solange ein Soldat bei ihm ist. Kosten: Hauptmann plus je Soldat. **Aufwerten** hebt die ganze Gattung
auf die nächste Stufe (auch bestehende Truppen).

**Schadensformel:** Schaden = ⌊Angriff × Faktor(Angriffsart, Rüstungsart) / 100⌋ − Rüstung + Zufall 0…2, mindestens 1.
Regen: Fernkampf {{rainRanged}}. Winter: Tempo {{winterSpeed}}. Feinde in {{sight}} Kacheln werden automatisch angegriffen, Verteidiger verfolgen höchstens {{leash}} Kacheln weit.

**Freischaltung je Stufe:** Stufe 1 braucht das Militärgebäude, Stufe 2 den passenden Veredler (bzw. das ausgebaute Militärgebäude bei Reiterei),
Stufe 3 das ausgebaute Militärgebäude, Stufe 4 zusätzlich die Festung.`,
    heroes: `Helden haben {{heroHp}} LP, kosten keine Bevölkerung und sterben nicht: Bei 0 LP werden sie bewusstlos und stehen nach
{{reviveS}} s ohne Feinde im Umkreis von {{reviveR}} Kacheln mit halben LP wieder auf. Angriffs- und Rüstungsart „Held“.
Fähigkeiten laden sich nach dem Einsatz wieder auf (Abklingzeit).`,
    techs: `**Hochschule/Universität:** vier Linien mit je vier Stufen. Stufe 2 braucht die Festung (Burg Stufe 2), Stufe 3 und 4 die Universität
(Hochschule Stufe 2); innerhalb einer Linie muss der Vorgänger erforscht sein. Forschungspunkte = Zeit × 10 × 2; jeder arbeitende Gelehrte
bringt 1 Punkt je Takt – mit zwei Gelehrten dauert eine Forschung genau die angegebene Zeit.

**Gebäude-Technologien** werden im jeweiligen Gebäude erforscht (Kosten sofort). Werkstätten forschen nur, solange dort Arbeiter arbeiten
(Überstunden ×2); Burg, Dorfzentrum und Militärgebäude forschen mit fester Rate. Je Gebäude eine Forschung zur Zeit.`,
    resources: `Jeder Rohstoff hat ein Konto **roh** und **veredelt**; beides ist verbaubar, bezahlt wird zuerst aus veredelt.
Veredler holen {{fetch}} Rohware je Gang und machen je Arbeitsgang aus 1 Rohware die angegebene Menge veredelte Ware.
Leibeigene: Holz {{chopYield}} je {{chopS}} s, Haufen {{mineYield}} je {{mineS}} s. Ein Baum hat {{treeWood}} Holz, ein Haufen {{pile}} Einheiten; Schächte sind unerschöpflich.`,
    economy: `**Zahltag** alle {{paydayS}} s. Einnahmen = ⌊Arbeiter × {{perWorker}} × Faktor / 100⌋, Ausgaben = Hauptleute × {{wage}} Taler Sold.
Der Steuersatz ist erst nach **Bildung** wählbar.

**Arbeiter:** Ein Arbeitsgang kostet {{cycleCost}} Ausdauer (voll: {{maxStamina}}). Ausdauer kommt durch Essen und Schlafen zurück,
jeweils multipliziert mit der Motivationswirkung ({{motCurve}}): Unter 100 % sackt die Leistung stark ab, darüber steigt sie gleichmäßig weiter.
Das Lagerfeuer gibt nur wenig feste Ausdauer – ohne Haus und Hof arbeiten Arbeiter ein Vielfaches langsamer, Motivation hilft dann kaum.
Das Haus bringt mehr als der Hof.
Ziergebäude heben den Höchstwert der Motivation um ihren Wert.`,
    weather: `Das Wetter folgt einem festen Zyklus je Karte (Missionen können ihn ändern). **Regen:** Fernkampf {{rainRanged}}, weniger Sicht.
**Winter:** Wasser friert und wird begehbar, Tempo {{winterSpeed}}, weniger Sicht; bei Tauwetter ertrinkt, wer auf dem Eis steht.
Mit dem **Wetterkraftwerk** wechselt man das Wetter selbst; danach läuft der Zyklus mit dem nächsten Eintrag weiter.`,
    experience: `Hauptleute sammeln Erfahrung: Jeder Treffer der Truppe zählt 1 Punkt. Die Wirkungen gelten für die ganze Truppe und sind kumulativ.`,
    damage: `Ein fertiges Gebäude unter {{burn}} % LP **brennt** und verliert {{burnPerS}} LP/s, bis es repariert ist oder zerfällt.
Leibeigene reparieren kostenlos ({{repair}} LP je Leibeigenem und Takt, höchstens {{builders}} gleichzeitig). Zerstörte Gebäude hinterlassen
{{ruinS}} s eine Ruine, die den Platz blockiert.`,
    market: `Der **Marktplatz** (Lager Stufe 2) tauscht in Schritten von {{step}}, höchstens {{max}} je Handel. Preise gelten für alle Spieler:
Nach jedem Handel steigt der Preis der gekauften Ware um {{change}} % des Grundwerts je Schritt, die bezahlte Ware wird ebenso billiger
(Grenzen {{min}} … {{maxP}} %). Jeder Schritt wird schon zum veränderten Preis abgerechnet – Hin-und-zurück-Handeln lohnt nie.
Alle {{recoverS}} s kehrt jeder Preis um {{recover}} % zum Grundwert zurück. Die Tabelle zeigt Kosten bei Grundpreisen.`,
    vision: `Jede Kachel ist je Team **unerkundet**, **erkundet** oder **sichtbar**. Gebäude sehen ab ihrer Mitte (plus halbe Kantenlänge).
Wetter zieht Sicht ab (mindestens {{minR}} Kacheln). Truppen sehen ihre Kampfsicht ({{sight}} Kacheln, + Fährtenlesen, + Feldwebel) plus einen Zuschlag je Gattung.`,
    slope: `Gebäude dürfen am Hang stehen: Bebaubar ist eine Fläche, wenn der Höhenunterschied ihrer Kacheln höchstens **{{maxSlope}} cm** beträgt
und sie frei von Wasser, Fels, Belegung und reservierten Plätzen ist. Beim Setzen der Baustelle ebnet die Simulation die Grundfläche
**dauerhaft** ein – auch nach Abriss bleibt die Ebene.

**Formeln** (Höhen ganzzahlig in cm):
- Zielhöhe = ⌊(2 × Summe der Höhen + n) / (2 × n)⌋, also der Mittelwert der n Kacheln, Halbe aufgerundet.
- Jede Kachel der Grundfläche bekommt die Zielhöhe.
- Übergangsrand (eine Kachel rundum): Kanten-Nachbar += ⌊(Ziel − Höhe) / 2⌋, Eck-Nachbar += ⌊(Ziel − Höhe) / 4⌋ (zur Null hin gerundet).
- Wasser, Fels, belegte Kacheln (Gebäude, Bäume, Haufen) und reservierte Plätze im Rand bleiben unverändert – Fundamente der Nachbarn
  werden nie verschoben. Begehbarkeit und Wege ändern sich nicht.

Im Beispiel steigt das Gelände um {{exStep}} cm je Kachel; unter der Fläche sind das {{exSlope}} cm (erlaubt), die größte Abtragung beträgt {{exCut}} cm.`,
    ai: `Die Computergegner nutzen dieselben Befehle wie Spielende und sehen nur, was ihr Team sieht. Ihre Stärke ergibt sich aus Reaktionszeit,
Armeegröße, Zahl der Baustellen und Aggressivität. Nur „Schwer“ hat einen kleinen Wissensvorteil (Wachen um die Burg). Takte: 10 je Sekunde.`,
    mapgen: `Karten entstehen aus der **Kartennummer** (Seed): gleiche Nummer, gleiche Welt. Der Generator legt Hügel, Täler, Gebirge mit Gipfeln,
Flüsse mit Furten, Seen und Küsten an, verteilt Bäume, Rohstoffhaufen, Schächte und Siedlungsplätze und setzt die Burgen in die Ecken.
Hänge steiler als {{cliff}} cm je Kachel und Gipfel über {{peak}} cm sind unpassierbar. Probier es aus:`,
  },
  en: {
    buildings: `All buildings with costs per upgrade level. **Build time** applies with {{builders}} serfs; with fewer it takes correspondingly longer.
You build freely, also on slopes (height difference under the building at most {{maxSlope}} cm, see [building on slopes](#slope)), village centres only on settlement spots,
mines only on shafts. Demolishing refunds half the cost. Armour: castle {{hqArmor}}, otherwise as listed (default 3).`,
    units: `Troops consist of a **captain** and his **soldiers**. Attack, armour and HP in the table apply to the captain; he is invulnerable as long
as one of his soldiers is with him. Cost: captain plus each soldier. **Upgrading** raises the whole troop type to the next tier (existing troops too).

**Damage formula:** damage = ⌊attack × factor(attack type, armour type) / 100⌋ − armour + random 0…2, at least 1.
Rain: ranged {{rainRanged}}. Winter: speed {{winterSpeed}}. Enemies within {{sight}} tiles are attacked automatically; defenders pursue at most {{leash}} tiles.

**Unlocking per tier:** tier 1 needs the military building, tier 2 the matching refiner (or the upgraded military building for cavalry),
tier 3 the upgraded military building, tier 4 additionally the fortress.`,
    heroes: `Heroes have {{heroHp}} HP, cost no population and never die: at 0 HP they become unconscious and get back up with half HP after
{{reviveS}} s without enemies within {{reviveR}} tiles. Attack and armour type “hero”. Abilities recharge after use (cooldown).`,
    techs: `**College/University:** four lines with four tiers each. Tier 2 needs the fortress (castle level 2), tiers 3 and 4 the university
(college level 2); within a line the predecessor must be researched. Research points = time × 10 × 2; each working scholar adds 1 point per
tick – with two scholars a technology takes exactly the stated time.

**Building technologies** are researched in their building (paid immediately). Workshops only research while workers are working there
(overtime ×2); castle, village centre and military buildings research at a fixed rate. One research per building at a time.`,
    resources: `Each resource has a **raw** and a **refined** account; both can be spent, refined goods are used first.
Refiners fetch {{fetch}} raw goods per trip and turn 1 raw good into the listed amount of refined goods per work cycle.
Serfs: wood {{chopYield}} per {{chopS}} s, piles {{mineYield}} per {{mineS}} s. A tree holds {{treeWood}} wood, a pile {{pile}} units; shafts never run out.`,
    economy: `**Payday** every {{paydayS}} s. Income = ⌊workers × {{perWorker}} × factor / 100⌋, expenses = captains × {{wage}} thalers in wages.
The tax rate can only be chosen after **Education**.

**Workers:** a work cycle costs {{cycleCost}} stamina (full: {{maxStamina}}). Stamina returns by eating and sleeping, each multiplied by
the motivation effect ({{motCurve}}): below 100 % output drops sharply, above it keeps rising steadily.
The campfire only gives a little fixed stamina – without house and farm, workers are many times slower and motivation barely helps.
The house is worth more than the farm.
Ornamental buildings raise the motivation maximum by their value.`,
    weather: `The weather follows a fixed cycle per map (missions may change it). **Rain:** ranged {{rainRanged}}, less sight.
**Winter:** water freezes and can be crossed, speed {{winterSpeed}}, less sight; when it thaws, anyone on the ice drowns.
The **weather power plant** lets you change the weather yourself; afterwards the cycle continues with the next entry.`,
    experience: `Captains gain experience: every hit of the troop counts 1 point. The effects apply to the whole troop and stack.`,
    damage: `A finished building below {{burn}} % HP **burns** and loses {{burnPerS}} HP/s until repaired or destroyed.
Serfs repair for free ({{repair}} HP per serf and tick, at most {{builders}} at once). Destroyed buildings leave a ruin for {{ruinS}} s that blocks the spot.`,
    market: `The **marketplace** (storehouse level 2) trades in steps of {{step}}, at most {{max}} per trade. Prices are shared by all players:
after each trade, the price of the bought good rises by {{change}} % of its base value per step and the paid good becomes cheaper the same way
(limits {{min}} … {{maxP}} %). Each step is already charged at the changed price – trading back and forth never pays.
Every {{recoverS}} s each price moves back towards its base value by {{recover}} %. The table shows costs at base prices.`,
    vision: `Every tile is **unexplored**, **explored** or **visible** per team. Buildings see from their centre (plus half their edge length).
Weather reduces sight (at least {{minR}} tiles). Troops see their combat sight ({{sight}} tiles, + Tracking, + Sergeant) plus a bonus per troop type.`,
    slope: `Buildings may stand on slopes: a footprint is buildable if the height difference of its tiles is at most **{{maxSlope}} cm**
and it is free of water, rock, occupation and reserved spots. When the building site is placed, the simulation levels the footprint
**permanently** – the pad remains even after demolition.

**Formulas** (integer heights in cm):
- Target height = ⌊(2 × sum of heights + n) / (2 × n)⌋, i.e. the mean of the n tiles, halves rounded up.
- Every footprint tile gets the target height.
- Transition border (one tile around): edge neighbour += ⌊(target − height) / 2⌋, corner neighbour += ⌊(target − height) / 4⌋ (rounded towards zero).
- Water, rock, occupied tiles (buildings, trees, piles) and reserved spots in the border stay unchanged – neighbouring foundations
  never move. Walkability and paths do not change.

In the example the ground rises {{exStep}} cm per tile; under the footprint that is {{exSlope}} cm (allowed), the largest cut is {{exCut}} cm.`,
    ai: `Computer opponents use the same commands as players and only see what their team sees. Their strength comes from reaction time,
army size, number of building sites and aggressiveness. Only “Hard” has a small information advantage (guards around the castle). 10 ticks per second.`,
    mapgen: `Maps are created from the **map number** (seed): same number, same world. The generator shapes hills, valleys, mountains with peaks,
rivers with fords, lakes and coasts, distributes trees, resource piles, shafts and settlement spots and places the castles in the corners.
Slopes steeper than {{cliff}} cm per tile and peaks above {{peak}} cm are impassable. Try it:`,
  },
};
