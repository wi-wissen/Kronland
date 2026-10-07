// Scripting reference: language-neutral part, shared by the command help of the world editor (ApiHelp.vue) and the
// website section scripting/ (src/site/scripting/). Texts (descriptions, parameters, return values) live in
// src/ui/script/docs/de.js / en.js so the game bundle stays small.
//
// - BASICS: Python basics shown in the command help of the world editor.
// - PY_DOC: built-in Python functions, math, random and the methods of str/list/tuple/dict
//   (same shape as API_DOC in src/sim/scripting/api.js; `also` = further names explained in the same entry).
// - EXAMPLES: one example per entry (string, or { de, en } when the example contains readable text).
//   Python examples run in the VM on the website (output shown); game examples run in a test scenario
//   (tests/site/scripting.test.js) – an example that stops working fails the tests.
// - ERRORS: typical error codes per entry (texts from src/i18n/script.js).

import { siteUrl } from '../../paths.js';

/** Python basics (no game API) for the command help of the world editor. */
export const BASICS = [
  { name: 'py.print', sig: 'print("Hallo", x)', example: 'print("Hallo!")' },
  { name: 'py.var', sig: 'x = 5', example: 'count = 0' },
  { name: 'py.if', sig: 'if …: … elif …: … else: …', example: 'if hero.can_step():\n    hero.step()\nelse:\n    hero.turn_left()' },
  { name: 'py.for', sig: 'for i in range(10):', example: 'for i in range(3):\n    hero.step()' },
  { name: 'py.while', sig: 'while …:', example: 'while hero.can_step():\n    hero.step()' },
  { name: 'py.def', sig: 'def name(a, b):', example: 'def turn_around():\n    hero.turn_left()\n    hero.turn_left()' },
  { name: 'py.list', sig: '[1, 2, 3], xs.append(4), len(xs)', example: 'trees = trees_near(hero)\nprint(len(trees))' },
  { name: 'py.dict', sig: '{"wood": 5}, d["wood"]', example: 'found = {}' },
  { name: 'py.fstring', sig: 'f"x = {x}"', example: 'print(f"Nelia steht bei {hero.x}, {hero.y}")' },
];

/** Anchors of the basics in the reference (chapter "language"). */
export const BASICS_ANCHOR = {
  'py.print': 'lang-print', 'py.var': 'lang-variables', 'py.if': 'lang-if', 'py.for': 'lang-for', 'py.while': 'lang-while',
  'py.def': 'lang-def', 'py.list': 'lang-lists', 'py.dict': 'lang-dicts', 'py.fstring': 'lang-strings',
};

/** Built-in Python functions, modules and methods. group: section of the reference. */
export const PY_DOC = [
  // Built-in functions
  { name: 'len', sig: 'len(obj)', group: 'pyfunc' },
  { name: 'range', sig: 'range(stop), range(start, stop, step=1)', group: 'pyfunc' },
  { name: 'int', sig: 'int(x=0, base=10)', group: 'pyfunc' },
  { name: 'float', sig: 'float(x=0)', group: 'pyfunc' },
  { name: 'str', sig: 'str(object="")', group: 'pyfunc' },
  { name: 'repr', sig: 'repr(obj)', group: 'pyfunc' },
  { name: 'bool', sig: 'bool(x=False)', group: 'pyfunc' },
  { name: 'list', sig: 'list(iterable=None)', group: 'pyfunc' },
  { name: 'tuple', sig: 'tuple(iterable=None)', group: 'pyfunc' },
  { name: 'dict', sig: 'dict(pairs=None, **values)', group: 'pyfunc' },
  { name: 'abs', sig: 'abs(x)', group: 'pyfunc' },
  { name: 'min', sig: 'min(iterable, key=None, default=…), min(a, b, …)', group: 'pyfunc', also: ['max'] },
  { name: 'sum', sig: 'sum(iterable, start=0)', group: 'pyfunc' },
  { name: 'sorted', sig: 'sorted(iterable, key=None, reverse=False)', group: 'pyfunc' },
  { name: 'reversed', sig: 'reversed(seq)', group: 'pyfunc' },
  { name: 'enumerate', sig: 'enumerate(iterable, start=0)', group: 'pyfunc' },
  { name: 'zip', sig: 'zip(*iterables)', group: 'pyfunc' },
  { name: 'map', sig: 'map(function, iterable, …)', group: 'pyfunc' },
  { name: 'filter', sig: 'filter(function, iterable)', group: 'pyfunc' },
  { name: 'any', sig: 'any(iterable), all(iterable)', group: 'pyfunc', also: ['all'] },
  { name: 'round', sig: 'round(number, ndigits=None)', group: 'pyfunc' },
  { name: 'divmod', sig: 'divmod(a, b)', group: 'pyfunc' },
  { name: 'pow', sig: 'pow(base, exp)', group: 'pyfunc' },
  { name: 'hex', sig: 'hex(x), bin(x), oct(x)', group: 'pyfunc', also: ['bin', 'oct'] },
  { name: 'chr', sig: 'chr(i), ord(c)', group: 'pyfunc', also: ['ord'] },
  { name: 'type', sig: 'type(object)', group: 'pyfunc' },
  { name: 'isinstance', sig: 'isinstance(obj, class)', group: 'pyfunc' },
  { name: 'callable', sig: 'callable(obj)', group: 'pyfunc' },
  { name: 'iter', sig: 'iter(obj), next(iterator, default=…)', group: 'pyfunc', also: ['next'] },
  { name: 'input', sig: 'input()', group: 'pyfunc' },
  // math
  { name: 'math.sqrt', sig: 'math.sqrt(x)', group: 'pymath' },
  { name: 'math.isqrt', sig: 'math.isqrt(n)', group: 'pymath' },
  { name: 'math.floor', sig: 'math.floor(x), math.ceil(x), math.trunc(x)', group: 'pymath', also: ['math.ceil', 'math.trunc'] },
  { name: 'math.fabs', sig: 'math.fabs(x)', group: 'pymath' },
  { name: 'math.hypot', sig: 'math.hypot(*coordinates)', group: 'pymath' },
  { name: 'math.dist', sig: 'math.dist(p, q)', group: 'pymath' },
  { name: 'math.gcd', sig: 'math.gcd(*integers)', group: 'pymath' },
  { name: 'math.pi', sig: 'math.pi, math.tau, math.e, math.inf, math.nan', group: 'pymath', also: ['math.tau', 'math.e', 'math.inf', 'math.nan'] },
  // random
  { name: 'random.random', sig: 'random.random()', group: 'pyrandom' },
  { name: 'random.randint', sig: 'random.randint(a, b)', group: 'pyrandom' },
  { name: 'random.randrange', sig: 'random.randrange(stop), random.randrange(start, stop, step=1)', group: 'pyrandom' },
  { name: 'random.choice', sig: 'random.choice(seq)', group: 'pyrandom' },
  { name: 'random.shuffle', sig: 'random.shuffle(x)', group: 'pyrandom' },
  { name: 'random.uniform', sig: 'random.uniform(a, b)', group: 'pyrandom' },
  { name: 'random.seed', sig: 'random.seed(a=0)', group: 'pyrandom' },
  // str
  { name: 'str.upper', sig: 's.upper(), s.lower(), s.capitalize(), s.title(), s.swapcase()', group: 'pystr', also: ['str.lower', 'str.capitalize', 'str.title', 'str.swapcase'] },
  { name: 'str.strip', sig: 's.strip(chars=None), s.lstrip(…), s.rstrip(…)', group: 'pystr', also: ['str.lstrip', 'str.rstrip'] },
  { name: 'str.split', sig: 's.split(sep=None, maxsplit=-1)', group: 'pystr' },
  { name: 'str.splitlines', sig: 's.splitlines()', group: 'pystr' },
  { name: 'str.join', sig: 'sep.join(iterable)', group: 'pystr' },
  { name: 'str.replace', sig: 's.replace(old, new, count=-1)', group: 'pystr' },
  { name: 'str.startswith', sig: 's.startswith(prefix), s.endswith(suffix)', group: 'pystr', also: ['str.endswith'] },
  { name: 'str.find', sig: 's.find(sub), s.rfind(sub)', group: 'pystr', also: ['str.rfind'] },
  { name: 'str.index', sig: 's.index(sub)', group: 'pystr' },
  { name: 'str.count', sig: 's.count(sub)', group: 'pystr' },
  { name: 'str.isdigit', sig: 's.isdigit(), s.isnumeric(), s.isalpha(), s.isalnum(), s.isspace(), s.isupper(), s.islower()', group: 'pystr', also: ['str.isnumeric', 'str.isalpha', 'str.isalnum', 'str.isspace', 'str.isupper', 'str.islower'] },
  { name: 'str.format', sig: 's.format(*args, **kwargs)', group: 'pystr' },
  { name: 'str.center', sig: 's.center(width, fillchar=" "), s.ljust(…), s.rjust(…)', group: 'pystr', also: ['str.ljust', 'str.rjust'] },
  { name: 'str.zfill', sig: 's.zfill(width)', group: 'pystr' },
  // list and tuple
  { name: 'list.append', sig: 'xs.append(object)', group: 'pylist' },
  { name: 'list.extend', sig: 'xs.extend(iterable)', group: 'pylist' },
  { name: 'list.insert', sig: 'xs.insert(index, object)', group: 'pylist' },
  { name: 'list.pop', sig: 'xs.pop(index=-1)', group: 'pylist' },
  { name: 'list.remove', sig: 'xs.remove(value)', group: 'pylist' },
  { name: 'list.index', sig: 'xs.index(value)', group: 'pylist' },
  { name: 'list.count', sig: 'xs.count(value)', group: 'pylist' },
  { name: 'list.sort', sig: 'xs.sort(key=None, reverse=False)', group: 'pylist' },
  { name: 'list.reverse', sig: 'xs.reverse()', group: 'pylist' },
  { name: 'list.copy', sig: 'xs.copy(), xs.clear()', group: 'pylist', also: ['list.clear'] },
  { name: 'tuple.index', sig: 't.index(value), t.count(value)', group: 'pylist', also: ['tuple.count'] },
  // dict
  { name: 'dict.keys', sig: 'd.keys(), d.values(), d.items()', group: 'pydict', also: ['dict.values', 'dict.items'] },
  { name: 'dict.get', sig: 'd.get(key, default=None)', group: 'pydict' },
  { name: 'dict.pop', sig: 'd.pop(key, default=…)', group: 'pydict' },
  { name: 'dict.setdefault', sig: 'd.setdefault(key, default=None)', group: 'pydict' },
  { name: 'dict.update', sig: 'd.update(other=None, **values)', group: 'pydict' },
  { name: 'dict.copy', sig: 'd.copy(), d.clear()', group: 'pydict', also: ['dict.clear'] },
];

/** Order of the sections: game API, then Python. */
export const API_GROUPS = ['flow', 'hero', 'world', 'village', 'story', 'events', 'goals', 'power', 'terrain', 'const'];
export const PY_GROUPS = ['pyfunc', 'pymath', 'pyrandom', 'pystr', 'pylist', 'pydict'];

const L = (de, en) => ({ de, en });

/** One example per entry. */
export const EXAMPLES = {
  // ---------- Flow ----------
  wait: 'hero.say("Ich ruhe mich kurz aus.")\nwait(2)\nhero.step()',
  wait_until: L(
    'ok = wait_until(lambda: stock("wood") >= 100, timeout=60)\nif ok:\n    print("Genug Holz!")\nelse:\n    print("Nach einer Minute immer noch zu wenig.")',
    'ok = wait_until(lambda: stock("wood") >= 100, timeout=60)\nif ok:\n    print("Enough wood!")\nelse:\n    print("Still too little after a minute.")',
  ),
  time: 'start = time()\nhero.step(3)\nprint("Drei Schritte dauerten", round(time() - start, 1), "s")',
  print: 'wood = stock("wood")\nprint("Holz:", wood)\nprint(1, 2, 3, sep=" - ")',
  notify: L('wood = stock("wood")\nif wood >= 100:\n    notify(f"Genug Holz: {wood}")\nprint("Holz:", wood)', 'wood = stock("wood")\nif wood >= 100:\n    notify(f"Enough wood: {wood}")\nprint("Wood:", wood)'),
  // ---------- Hero ----------
  hero: 'print(hero, hero.name, hero.x, hero.y)\nprint(nelia is hero)',
  'hero.step': 'hero.step()\nhero.step(2)',
  'hero.turn_left': 'hero.turn_left()\nprint(hero.facing)',
  'hero.turn_right': 'hero.turn_right()\nhero.turn_right()\nprint(hero.facing)  # "west"',
  'hero.turn_to': 'hero.turn_to("north")\nwhile hero.can_step():\n    hero.step()',
  'hero.ahead': 'what = hero.ahead()\nif what == "tree":\n    hero.chop()\nelif what == "pile":\n    hero.take()\nelse:\n    print("Vor mir:", what)',
  'hero.can_step': 'steps = 0\nwhile hero.can_step() and steps < 5:\n    hero.step()\n    steps += 1\nprint(steps, "Schritte")',
  'hero.move_to': 'hero.move_to(place("goal"))\nhero.move_to((5, 9))\nprint(hero.is_at((5, 9)))',
  'hero.is_at': 'hero.move_to(place("goal"))\nif hero.is_at(place("goal")):\n    hero.say("Angekommen!")',
  'hero.take': 'if hero.ahead() == "pile":\n    res = hero.take()\n    print("Aufgehoben:", res)',
  'hero.chop': 'while hero.ahead() == "tree":\n    hero.chop()\nprint("Holz im Lager:", stock("wood"))',
  'hero.say': L('hero.say("Hier lang!")', 'hero.say("This way!")'),
  'hero.facing': 'if hero.facing != "north":\n    hero.turn_to("north")',
  'hero.x': 'print(f"Nelia steht bei ({hero.x}, {hero.y})")\nprint(tile(hero.x + 1, hero.y))',
  // ---------- World ----------
  place: 'goal = place("goal")\nprint(goal.x, goal.y, goal.r)\nhero.move_to(goal)',
  places: 'for name in places():\n    p = place(name)\n    print(name, p.x, p.y)',
  tile: 'x, y = hero.x, hero.y\nfor dx in range(1, 4):\n    print(x + dx, y, tile(x + dx, y))',
  distance: 'd = distance(hero, place("goal"))\nprint("Noch", round(d, 1), "Kacheln")',
  'obj.distance_to': 'trees = trees_near(hero, radius=20)\nif trees:\n    print(round(trees[0].distance_to(hero), 1))',
  'place.contains': 'camp = place("camp")\nprint(camp.contains(hero))\nprint(camp.contains((camp.x, camp.y)))',
  trees_near: 'trees = trees_near(hq(), radius=12)\nprint(len(trees), "Bäume in der Nähe")\nif trees:\n    t = trees[0]\n    print("Der nächste steht bei", t.x, t.y, "mit", t.amount, "Holz")',
  piles_near: 'for p in piles_near(hq(), radius=20, res="stone"):\n    print(p, p.amount)',
  // ---------- Village ----------
  stock: 'for res in ["wood", "clay", "stone", "iron", "sulfur", "gold"]:\n    print(res, stock(res))',
  count: 'print("Wohnhäuser:", count("residence"))\nprint("Leibeigene:", count("serf"))\nprint("Trupps:", count("troop"))',
  serfs: 'idle = serfs(idle=True)\nprint(len(idle), "von", len(serfs()), "Leibeigenen haben nichts zu tun")',
  troops: 'for t in troops():\n    print(t.type, t.soldiers, "Soldaten bei", t.x, t.y)',
  buildings: 'for b in buildings("residence"):\n    print(b, "Stufe", b.level, "fertig" if b.done else "im Bau")',
  hq: 'castle = hq()\nif castle:\n    print("Burg bei", castle.x, castle.y, "mit", castle.hp, "Lebenspunkten")',
  find_spot: 'spot = find_spot("farm", hq(), radius=15)\nif spot:\n    x, y = spot\n    print("Platz für einen Bauernhof:", x, y)',
  can_build: 'spot = find_spot("residence", hq())\nif spot and can_build("residence", spot[0], spot[1]):\n    build("residence", spot[0], spot[1])',
  build: 'x, y = find_spot("residence", hq())\nsite = build("residence", x, y)\nfor s in serfs(idle=True)[:3]:\n    s.work_on(site)',
  buy_serf: 'if stock("gold") >= 200 and count("villageCenter") > 0:\n    buy_serf(2)\nprint(count("serf"), "Leibeigene")',
  'unit.move_to': 's = serfs()[0]\ns.move_to(place("gate"), wait=False)\nprint("Unterwegs, das Programm läuft weiter")',
  'unit.is_at': 's = serfs()[0]\ns.move_to((14, 18))\nprint(s.is_at((14, 18)))',
  'unit.work_on': 'trees = trees_near(hq(), radius=15)\nfor s, t in zip(serfs(idle=True), trees):\n    s.work_on(t)',
  'unit.attack': 'for t in troops():\n    if t.soldiers >= 3:\n        t.attack(place("camp"))',
  'building.upgrade': 'for b in buildings("residence"):\n    if b.done and b.level == 1:\n        b.upgrade()\n        break',
  // ---------- Staging ----------
  say: L(
    'say("nelia", "Da hinten liegt das Lager der Räuber.")\nsay("kunz", "Kommt nur her!", seconds=3)',
    'say("nelia", "The bandit camp is over there.")\nsay("kunz", "Come and get it!", seconds=3)',
  ),
  message: L('message("Ein Händler ist eingetroffen.")', 'message("A merchant has arrived.")'),
  'camera.jump_to': 'camera.jump_to(hq())',
  'camera.fly_to': 'camera.fly_to(place("camp"), seconds=3)\ncamera.fly_to(hero, seconds=2)',
  reveal: 'reveal(place("camp"), radius=8, seconds=20)',
  // ---------- Events ----------
  on_start: L('@on_start\ndef intro():\n    camera.jump_to(hq())\n    say("nelia", "Willkommen in Kronland!")', '@on_start\ndef intro():\n    camera.jump_to(hq())\n    say("nelia", "Welcome to Kronland!")'),
  every: L(
    'raids = 0\n\n@every(120)\ndef raid():\n    global raids\n    raids += 1\n    attackers = spawn(BANDITS, "sword1", place("gate"), count=raids)\n    attack(attackers, hq())',
    'raids = 0\n\n@every(120)\ndef raid():\n    global raids\n    raids += 1\n    attackers = spawn(BANDITS, "sword1", place("gate"), count=raids)\n    attack(attackers, hq())',
  ),
  on_building_done: L('@on_building_done("farm")\ndef farm_ready(building):\n    say("nelia", "Der Bauernhof ist fertig!")\n    give(HUMAN, gold=100)', '@on_building_done("farm")\ndef farm_ready(building):\n    say("nelia", "The farm is finished!")\n    give(HUMAN, gold=100)'),
  on_building_placed: L('@on_building_placed\ndef placed(building):\n    message(f"Neue Baustelle: {building.type}")', '@on_building_placed\ndef placed(building):\n    message(f"New construction site: {building.type}")'),
  on_destroyed: '@on_destroyed("headquarters", HUMAN)\ndef lost(kind, owner):\n    defeat("hq")',
  on_killed: 'losses = 0\n\n@on_killed(HUMAN)\ndef fallen(kind, owner):\n    global losses\n    losses += 1\n    if losses >= 10:\n        defeat()',
  on_recruited: L('@on_recruited\ndef recruited(troop):\n    say("taran", f"Ein Trupp {troop.type} steht bereit.")', '@on_recruited\ndef recruited(troop):\n    say("taran", f"A troop of {troop.type} is ready.")'),
  on_research: L('@on_research("conscription")\ndef researched(tech):\n    message("Jetzt kannst du eine Kaserne bauen.")', '@on_research("conscription")\ndef researched(tech):\n    message("Now you can build a barracks.")'),
  on_enter: L('@on_enter(place("camp"), who="hero")\ndef found(unit):\n    say("nelia", "Das Lager ist verlassen …")\n    complete("scout")', '@on_enter(place("camp"), who="hero")\ndef found(unit):\n    say("nelia", "The camp is deserted …")\n    complete("scout")'),
  on_objective: '@on_objective("camp", status="done")\ndef won(id, status):\n    victory()',
  on_weather: L('@on_weather("winter")\ndef cold(state):\n    message("Die Flüsse frieren zu – Vorsicht an den Ufern!")', '@on_weather("winter")\ndef cold(state):\n    message("The rivers are freezing – watch the banks!")'),
  // ---------- Goals ----------
  objective: L(
    'objective("homes", "Baue 3 Wohnhäuser", lambda: count("residence") >= 3)\nobjective("gold", "Spare 1000 Gold", lambda: stock("gold") >= 1000, primary=False)',
    'objective("homes", "Build 3 residences", lambda: count("residence") >= 3)\nobjective("gold", "Save 1000 gold", lambda: stock("gold") >= 1000, primary=False)',
  ),
  complete: L('objective("scout", "Erkunde das Lager")\n\n@on_enter(place("camp"), who="hero")\ndef scouted(unit):\n    complete("scout")', 'objective("scout", "Scout the camp")\n\n@on_enter(place("camp"), who="hero")\ndef scouted(unit):\n    complete("scout")'),
  fail: L('objective("escort", "Bringe Orrin sicher heim")\n\n@on_killed(HUMAN)\ndef check(kind, owner):\n    if orrin and orrin.down:\n        fail("escort")', 'objective("escort", "Bring Orrin home safely")\n\n@on_killed(HUMAN)\ndef check(kind, owner):\n    if orrin and orrin.down:\n        fail("escort")'),
  show_objective: L('objective("camp", "Zerstöre das Räuberlager", hidden=True)\nwait(30)\nshow_objective("camp")', 'objective("camp", "Destroy the bandit camp", hidden=True)\nwait(30)\nshow_objective("camp")'),
  victory: 'wait_until(lambda: len(buildings("banditCamp", BANDITS)) == 0)\nvictory()',
  defeat: 'wait_until(lambda: not hero.alive or hero.down)\ndefeat("hero")',
  // ---------- Intervening ----------
  spawn: 'guards = spawn(BANDITS, "spear1", place("camp"), count=2, soldiers=3)\nprint(len(guards), "Trupps bewachen das Lager")',
  spawn_serfs: 'new = spawn_serfs(HUMAN, 4)\nfor s in new:\n    print(s, s.idle)',
  give: 'give(HUMAN, wood=300, stone=100)\ngive(HUMAN, gold=-50)\nprint(stock("wood"), stock("gold"))',
  set_diplomacy: 'set_diplomacy(HUMAN, ENEMY, "neutral")\nprint(diplomacy(HUMAN, ENEMY))',
  diplomacy: 'if diplomacy(HUMAN, BANDITS) == "hostile":\n    print("Vorsicht vor den Räubern!")',
  give_tech: 'give_tech(HUMAN, "conscription", "construction")',
  place_building: 'camp = place_building(BANDITS, "banditCamp", place("camp"))\nprint(camp, camp.hp)\nsite = place_building(HUMAN, "farm", hq(), done=False)',
  remove: 'trees = trees_near(place("gate"), radius=3)\nremove(trees)',
  'hero.teleport': 'hero.teleport(place("goal"))\nprint(hero.x, hero.y)',
  'obj.kill': 'for t in troops(BANDITS):\n    t.kill()',
  attack: 'wave = spawn(BANDITS, "sword1", place("gate"), count=3)\nattack(wave, hq())',
  move: 'move(troops(), place("gate"))',
  units_in: 'inside = units_in(place("gate"), HUMAN, who="troop")\nprint(len(inside), "eigene Trupps am Tor")',
  alive: 'wave = spawn(BANDITS, "sword1", place("gate"), count=3)\nattack(wave, hq())\nwait_until(lambda: alive(wave) == 0)\nmessage("Angriff abgewehrt!")',
  hero_of: 'o = hero_of(HUMAN, "orrin")\nif o is None:\n    print("Orrin ist nicht dabei.")\nenemy = hero_of(ENEMY)\nprint(enemy)',
  set_weather: 'set_weather("winter", seconds=90)',
  ai: 'ai(ENEMY, difficulty="hard", aggression="passive", start_in=120)',
  // ---------- Terrain ----------
  make_place: 'make_place("well", 20, 14, r=2)\nhero.move_to(place("well"))',
  find_open: 'spot = find_open(map_center(), min_r=4, max_r=16)\nif spot:\n    make_place("ruins", spot.x, spot.y, 3)',
  toward: 'mid = toward(hq(), map_center(), 10)\nmake_place("outpost", mid.x, mid.y, 3)',
  map_center: 'c = map_center()\nprint(c.x, c.y)\ncamera.jump_to(c)',
  plant_trees: 'n = plant_trees((26, 12), 25, radius=5)\nprint(n, "Bäume gepflanzt")',
  add_tree: 'for x in range(10, 20, 2):\n    add_tree(x, 30)',
  add_pile: 'add_pile("stone", 20, 24, amount=400)\nadd_pile("clay", 24, 22)',
  clear_area: 'clear_area(place("camp"), 5)',
  'world.width': 'print(world.width, "×", world.height, "Kacheln")\nprint("Wasserspiegel:", world.water_level)',
  'world.height_at': 'h = world.height_at(10, 10)\nprint("Höhe:", h, "cm")',
  'world.is_water': 'water = 0\nfor x in range(world.width):\n    if world.is_water(x, 20):\n        water += 1\nprint(water, "Wasserkacheln in Zeile 20")',
  'world.set_height': '# kleiner Hügel um (30, 30)\nfor dx in range(-3, 4):\n    for dy in range(-3, 4):\n        d = abs(dx) + abs(dy)\n        world.set_height(30 + dx, 30 + dy, 600 - d * 100)',
  'world.set_water': '# ein Bach quer über die Karte\nfor y in range(world.height):\n    world.set_water(36, y)',
  'world.set_cliff': 'for x in range(5, 12):\n    world.set_cliff(x, 40)',
  'world.noise': 'for x in range(0, 48):\n    for y in range(0, 48):\n        n = world.noise(x, y, cell=16)\n        if n > 900:\n            add_tree(x, y)',
  // ---------- Constants ----------
  HUMAN: 'print(HUMAN, ENEMY, BANDITS)\nprint(stock("gold", HUMAN))',

  // ---------- Python: built-in functions ----------
  len: 'stock = {"wood": 120, "stone": 40}\nprint(len(stock))\nprint(len("Kronland"), len([3, 1, 4]))',
  range: 'print(list(range(5)))\nprint(list(range(2, 10, 3)))\nfor i in range(3, 0, -1):\n    print(i)',
  int: 'print(int("42") + 1)\nprint(int(3.9), int(-3.9))\nprint(int("ff", 16), int("101", 2))',
  float: 'print(float("2.5") * 2)\nprint(float(7))\nprint(7 / 2, float("inf"))',
  str: 'wood = 120\nprint("Holz: " + str(wood))\nprint(str(3.5), str(True), str(None))',
  repr: 'print(repr("wood"), repr([1, "a"]))\nprint(str("wood"))',
  bool: 'print(bool(0), bool(3), bool(""), bool("x"))\nprint(bool([]), bool([0]), bool(None))',
  list: 'print(list("abc"))\nprint(list(range(4)))\nprint(list({"wood": 1, "gold": 2}))',
  tuple: 'pos = tuple([4, 7])\nx, y = pos\nprint(pos, x, y)',
  dict: 'costs = dict(wood=150, stone=100)\nprint(costs)\nprint(dict([("gold", 50), ("iron", 10)]))',
  abs: 'print(abs(-7), abs(2.5))\ndx = 3 - 10\nprint("Abstand in x:", abs(dx))',
  min: 'print(min(4, 1, 7), max([4, 1, 7]))\nwords = ["wood", "iron", "sulfur"]\nprint(max(words, key=len))\nprint(min([], default=0))',
  sum: 'harvest = [12, 30, 8]\nprint(sum(harvest))\nprint(sum([0.5, 0.25], 1))',
  sorted: 'stock = {"wood": 120, "stone": 40, "gold": 300}\nprint(sorted(stock))\nprint(sorted(stock, key=lambda r: stock[r], reverse=True))',
  reversed: 'print(list(reversed([1, 2, 3])))\nfor c in reversed("abc"):\n    print(c)',
  enumerate: 'for i, res in enumerate(["wood", "clay", "stone"], start=1):\n    print(i, res)',
  zip: 'names = ["wood", "stone"]\namounts = [120, 40]\nfor n, a in zip(names, amounts):\n    print(n, a)\nprint(dict(zip(names, amounts)))',
  map: 'print(list(map(str, [1, 2, 3])))\nprint(list(map(lambda x: x * 2, [1, 2, 3])))',
  filter: 'amounts = [0, 12, 0, 40]\nprint(list(filter(lambda a: a > 0, amounts)))\nprint(list(filter(None, amounts)))',
  any: 'amounts = [0, 12, 40]\nprint(any(a > 30 for a in amounts))\nprint(all(a > 0 for a in amounts))',
  round: 'print(round(2.675, 2), round(3.14159, 3))\nprint(round(2.5), round(3.5), round(1234, -2))',
  divmod: 'seconds = 135\nminutes, rest = divmod(seconds, 60)\nprint(minutes, "min", rest, "s")',
  pow: 'print(pow(2, 10), 2 ** 10)\nprint(pow(2, -1))',
  hex: 'print(hex(255), bin(5), oct(8))\nprint(int("0xff", 16))',
  chr: 'print(ord("A"), chr(66))\nprint("".join(chr(ord("a") + i) for i in range(5)))',
  type: 'print(type(5), type(2.5), type("x"))\nprint(type([]) == list)',
  isinstance: 'for v in [3, 2.5, "3", True]:\n    print(repr(v), isinstance(v, int), isinstance(v, (int, float)))',
  callable: 'def greet():\n    return "Hallo"\nprint(callable(greet), callable(print), callable(5))',
  iter: 'it = iter([10, 20])\nprint(next(it))\nprint(next(it))\nprint(next(it, "fertig"))',
  input: '# input() gibt es nicht – Werte stehen direkt im Programm:\nname = "Nelia"\nprint("Hallo", name)',
  // ---------- Python: math ----------
  'math.sqrt': 'import math\nprint(math.sqrt(16), math.sqrt(2))\nx, y = 3, 4\nprint(math.sqrt(x * x + y * y))',
  'math.isqrt': 'import math\nprint(math.isqrt(17), math.isqrt(16))',
  'math.floor': 'import math\nprint(math.floor(2.7), math.ceil(2.1), math.trunc(-2.7))\nprint(math.floor(-2.7))',
  'math.fabs': 'import math\nprint(math.fabs(-3), abs(-3))',
  'math.hypot': 'import math\nprint(math.hypot(3, 4))\nprint(math.hypot(1, 2, 2))',
  'math.dist': 'import math\nprint(math.dist((1, 2), (4, 6)))',
  'math.gcd': 'import math\nprint(math.gcd(12, 18), math.gcd(7, 5))',
  'math.pi': 'import math\nr = 3\nprint(round(math.pi * r * r, 2))\nprint(math.tau, math.e)\nprint(math.inf > 10 ** 100, math.nan == math.nan)',
  // ---------- Python: random ----------
  'random.random': 'import random\nrandom.seed(7)\nif random.random() < 0.25:\n    print("Glück gehabt!")\nprint(random.random())',
  'random.randint': 'import random\nrandom.seed(3)\nprint([random.randint(1, 6) for i in range(5)])',
  'random.randrange': 'import random\nrandom.seed(4)\nprint(random.randrange(10), random.randrange(0, 100, 10))',
  'random.choice': 'import random\nrandom.seed(2)\nprint(random.choice(["wood", "clay", "stone"]))',
  'random.shuffle': 'import random\nrandom.seed(5)\norder = [1, 2, 3, 4, 5]\nrandom.shuffle(order)\nprint(order)',
  'random.uniform': 'import random\nrandom.seed(6)\nprint(round(random.uniform(1.5, 2.5), 3))',
  'random.seed': 'import random\nrandom.seed(42)\na = random.randint(1, 100)\nrandom.seed(42)\nb = random.randint(1, 100)\nprint(a == b)',
  // ---------- Python: str ----------
  'str.upper': 'name = "nelia von kronland"\nprint(name.upper())\nprint(name.title())\nprint(name.capitalize(), "ABC".lower(), "aBc".swapcase())',
  'str.strip': 'line = "   wood  \\n"\nprint(repr(line.strip()))\nprint(repr("--wood--".strip("-")), repr("  x ".lstrip()))',
  'str.split': 'line = "wood, stone, gold"\nprint(line.split(", "))\nprint("a b   c".split())\nprint("1-2-3".split("-", 1))',
  'str.splitlines': 'text = "erste Zeile\\nzweite Zeile\\n"\nprint(text.splitlines())',
  'str.join': 'res = ["wood", "stone", "gold"]\nprint(", ".join(res))\nprint("-".join(str(i) for i in range(4)))',
  'str.replace': 'print("Holz Holz Holz".replace("Holz", "Stein"))\nprint("a-b-c".replace("-", "", 1))',
  'str.startswith': 'kind = "sword1"\nprint(kind.startswith("sword"), kind.endswith("1"))\nprint("bow2".startswith(("sword", "bow")))',
  'str.find': 's = "wood-stone-wood"\nprint(s.find("wood"), s.rfind("wood"), s.find("gold"))',
  'str.index': 'print("Kronland".index("land"))',
  'str.count': 'print("banana".count("a"), "a,b,c".count(","))',
  'str.isdigit': 'for s in ["42", "4.2", "Holz", "Holz2", " "]:\n    print(repr(s), s.isdigit(), s.isalpha(), s.isalnum(), s.isspace())',
  'str.format': 'print("{} hat {} Holz".format("Nelia", 120))\nprint("{name}: {n:>5}".format(name="Gold", n=300))\nprint("{:.1f} %".format(12.345))',
  'str.center': 'print("[" + "Holz".center(10, "*") + "]")\nprint("[" + "Holz".ljust(8) + "]" + "[" + "12".rjust(5) + "]")',
  'str.zfill': 'print("7".zfill(3), "-42".zfill(5))',
  // ---------- Python: list ----------
  'list.append': 'trees = []\ntrees.append("Eiche")\ntrees.append("Buche")\nprint(trees, len(trees))',
  'list.extend': 'a = [1, 2]\na.extend([3, 4])\na.extend(range(5, 7))\nprint(a)',
  'list.insert': 'queue = ["farm", "residence"]\nqueue.insert(0, "university")\nprint(queue)',
  'list.pop': 'queue = ["farm", "residence", "chapel"]\nlast = queue.pop()\nfirst = queue.pop(0)\nprint(first, last, queue)',
  'list.remove': 'res = ["wood", "gold", "wood"]\nres.remove("wood")\nprint(res)',
  'list.index': 'res = ["wood", "clay", "stone"]\nprint(res.index("stone"))',
  'list.count': 'rolls = [6, 2, 6, 3, 6]\nprint(rolls.count(6))',
  'list.sort': 'amounts = [40, 120, 8]\namounts.sort()\nprint(amounts)\nwords = ["sulfur", "wood", "iron"]\nwords.sort(key=len, reverse=True)\nprint(words)',
  'list.reverse': 'path = [1, 2, 3]\npath.reverse()\nprint(path)',
  'list.copy': 'a = [1, 2, 3]\nb = a.copy()\nb.append(4)\na.clear()\nprint(a, b)',
  'tuple.index': 'pos = (4, 7, 4)\nprint(pos.index(7), pos.count(4))',
  // ---------- Python: dict ----------
  'dict.keys': 'stock = {"wood": 120, "stone": 40}\nprint(list(stock.keys()), list(stock.values()))\nfor res, n in stock.items():\n    print(res, n)',
  'dict.get': 'stock = {"wood": 120}\nprint(stock.get("wood"), stock.get("iron"), stock.get("iron", 0))',
  'dict.pop': 'orders = {"farm": 2, "chapel": 1}\nn = orders.pop("farm")\nprint(n, orders, orders.pop("tower", 0))',
  'dict.setdefault': 'counts = {}\nfor kind in ["tree", "pile", "tree"]:\n    counts.setdefault(kind, 0)\n    counts[kind] += 1\nprint(counts)',
  'dict.update': 'stock = {"wood": 120}\nstock.update({"stone": 40}, gold=300)\nprint(stock)',
  'dict.copy': 'a = {"wood": 1}\nb = a.copy()\nb["wood"] = 99\na.clear()\nprint(a, b)',
};

/** Typical errors per entry: error codes (err.script.…, script.game.…) with the variant after a dot. */
export const ERRORS = {
  wait: ['err.script.type.numberNeeded'],
  notify: ['err.script.argMissing'],
  wait_until: ['err.script.type.callableNeeded', 'err.script.type.waitInSync'],
  'hero.step': ['script.game.blocked', 'script.game.heroDown'],
  'hero.turn_to': ['script.game.dirUnknown'],
  'hero.move_to': ['err.script.type.targetNeeded', 'script.game.placeUnknown'],
  'hero.take': ['script.game.noPile'],
  'hero.chop': ['script.game.noTree'],
  place: ['script.game.placeUnknown'],
  tile: ['err.script.type.numberNeeded'],
  distance: ['err.script.type.targetNeeded', 'script.game.gone'],
  trees_near: ['err.script.type.targetNeeded'],
  piles_near: ['script.game.resUnknown'],
  stock: ['script.game.resUnknown'],
  count: ['script.game.kindUnknown'],
  buildings: ['script.game.buildingUnknown'],
  find_spot: ['script.game.buildingUnknown'],
  can_build: ['script.game.buildingUnknown'],
  build: ['script.game.buildingUnknown', 'err.script.game'],
  buy_serf: ['err.script.game'],
  'unit.move_to': ['script.game.cannotMove', 'script.game.notYours'],
  'unit.work_on': ['err.script.type.entityNeeded', 'script.game.notYours'],
  'unit.attack': ['script.game.notYours', 'script.game.gone'],
  'building.upgrade': ['err.script.game', 'script.game.notYours'],
  'obj.distance_to': ['script.game.gone'],
  'camera.fly_to': ['err.script.type.targetNeeded'],
  every: ['err.script.type.decoratorFunction'],
  objective: ['script.game.objectiveExists'],
  complete: ['script.game.objectiveUnknown'],
  spawn: ['script.game.unitUnknown', 'script.game.playerUnknown'],
  give: ['script.game.resUnknown'],
  set_diplomacy: ['script.game.diplomacyUnknown'],
  give_tech: ['script.game.techUnknown'],
  place_building: ['script.game.noSpace', 'script.game.buildingUnknown'],
  'hero.teleport': ['script.game.cannotMove'],
  set_weather: ['script.game.weatherUnknown'],
  'world.height_at': ['script.game.outside'],
  'world.set_height': ['script.game.outside'],
  'world.set_water': ['script.game.outside'],
  add_pile: ['script.game.resUnknown'],
  len: ['err.script.type.noLen'],
  range: ['err.script.type.intNeeded', 'err.script.value.rangeStep'],
  int: ['err.script.value.intLiteral', 'err.script.type.convert'],
  float: ['err.script.value.floatLiteral'],
  min: ['err.script.value.emptySeq', 'err.script.compare'],
  sum: ['err.script.operand'],
  sorted: ['err.script.compare'],
  dict: ['err.script.value.dictPair'],
  round: ['err.script.type.numberNeeded'],
  divmod: ['err.script.zeroDivision'],
  pow: ['err.script.powFraction'],
  chr: ['err.script.value.chrRange', 'err.script.type.ordLength'],
  iter: ['err.script.stopIteration', 'err.script.notIterable'],
  input: ['err.script.notSupported.input'],
  'math.sqrt': ['err.script.mathDomain'],
  'math.isqrt': ['err.script.mathDomain', 'err.script.type.intNeeded'],
  'math.dist': ['err.script.value.distLength'],
  'random.randint': ['err.script.value.emptyRange'],
  'random.choice': ['err.script.index.choiceEmpty'],
  'random.shuffle': ['err.script.type.listNeeded'],
  'str.split': ['err.script.value.emptySeparator'],
  'str.join': ['err.script.type.joinStr'],
  'str.index': ['err.script.value.substringNotFound'],
  'str.format': ['err.script.index.formatIndex', 'err.script.key'],
  'list.pop': ['err.script.index.popEmpty', 'err.script.index.list'],
  'list.remove': ['err.script.value.notInList'],
  'list.index': ['err.script.value.notInList'],
  'list.sort': ['err.script.compare'],
  'dict.pop': ['err.script.key'],
};

/**
 * English wording of the German texts and comments in the examples (plain string examples). Applied for 'en';
 * keeps one example per entry instead of two copies that drift apart.
 */
const EN_TEXT = [
  ['Ich ruhe mich kurz aus.', 'Let me rest for a moment.'], ['Drei Schritte dauerten', 'Three steps took'], ['Holz im Lager:', 'Wood in stock:'],
  ['"Holz: "', '"Wood: "'], ['Holz:', 'Wood:'], ['Vor mir:', 'Ahead of me:'], ['"Schritte"', '"steps"'], ['Aufgehoben:', 'Picked up:'],
  ['Nelia steht bei', 'Nelia stands at'], ['"Noch"', '"Still"'], ['Wasserkacheln in Zeile 20', 'water tiles in row 20'], ['"Kacheln"', '"tiles"'],
  ['Bäume in der Nähe', 'trees nearby'], ['Der nächste steht bei', 'The nearest stands at'], ['"mit"', '"with"'], ['"Holz")', '"wood")'],
  ['Wohnhäuser:', 'Residences:'], ['"Leibeigene:"', '"Serfs:"'], ['"Trupps:"', '"Troops:"'], ['"von"', '"of"'],
  ['Leibeigenen haben nichts zu tun', 'serfs have nothing to do'], ['Soldaten bei', 'soldiers at'], ['"Stufe"', '"level"'],
  ['"fertig" if', '"done" if'], ['"im Bau"', '"under construction"'], ['Burg bei', 'Castle at'], ['Lebenspunkten', 'hit points'],
  ['Platz für einen Bauernhof:', 'Room for a farm:'], ['"Leibeigene")', '"serfs")'], ['Unterwegs, das Programm läuft weiter', 'On the way, the program continues'],
  ['Trupps bewachen das Lager', 'troops guard the camp'], ['Vorsicht vor den Räubern!', 'Beware of the bandits!'], ['eigene Trupps am Tor', 'own troops at the gate'],
  ['Angriff abgewehrt!', 'Attack repelled!'], ['Orrin ist nicht dabei.', 'Orrin is not here.'], ['Bäume gepflanzt', 'trees planted'],
  ['Wasserspiegel:', 'Water level:'], ['Höhe:', 'Height:'], ['# kleiner Hügel um (30, 30)', '# a small hill around (30, 30)'],
  ['# ein Bach quer über die Karte', '# a stream across the map'], ['"Hallo"', '"Hello"'], ['"fertig")', '"done")'],
  ['# input() gibt es nicht – Werte stehen direkt im Programm:', '# there is no input() – values are written into the program:'],
  ['Glück gehabt!', 'Lucky!'], ['nelia von kronland', 'nelia of kronland'], ['erste Zeile\\nzweite Zeile\\n', 'first line\\nsecond line\\n'],
  ['"Holz Holz Holz".replace("Holz", "Stein")', '"wood wood wood".replace("wood", "stone")'], ['"Holz", "Holz2"', '"wood", "wood2"'],
  ['{} hat {} Holz', '{} has {} wood'], ['"Holz".center', '"wood".center'], ['"Holz".ljust', '"wood".ljust'], ['"Eiche"', '"oak"'], ['"Buche"', '"beech"'],
  ['Hallo!', 'Hello!'], ['Angekommen!', 'Arrived!'],
  ['# Abenteuer 1: zehn Schritte geradeaus', '# Adventure 1: ten steps straight ahead'],
  ['# Abenteuer 2: um die Ecke – laufen, bis das Ziel erreicht ist', '# Adventure 2: round the corner – walk until the goal is reached'],
  ['# Abenteuer 3: die ganze Baumreihe fällen, egal wie lang sie ist', '# Adventure 3: fell the whole row of trees, however long it is'],
  ['Bäume gefällt', 'trees felled'], ['# Abenteuer 4: links und rechts nach Steinen schauen', '# Adventure 4: look left and right for stones'],
  ['# Abenteuer 5: ein Dorf per Programm', '# Adventure 5: a village by program'], ['Fertig nach', 'Done after'], ['"Sekunden"', '"seconds"'],
  ['# Holzfäller: untätige Leibeigene an die nächsten Bäume schicken', '# Lumberjacks: send idle serfs to the nearest trees'],
  ['Leibeigene fällen Bäume', 'serfs are felling trees'], ['Nach 30 Sekunden:', 'After 30 seconds:'], ['Holz mehr', 'more wood'],
  ['# Bestandsaufnahme: Gebäude zählen, Figuren durchlaufen', '# Inventory: count buildings, walk through figures'],
  ['Soldaten, {d} Kacheln von der Burg', 'soldiers, {d} tiles from the castle'], ['Am meisten:', 'Most of all:'],
  ['# Mission: drei Angriffswellen, danach Sieg', '# Mission: three attack waves, then victory'], ['Überstehe drei Angriffe', 'Survive three attacks'],
  ['Welle {waves} kommt!', 'Wave {waves} is coming!'],
  ['# Weltaufbau: Hügel aus Rauschen, ein Bach, ein Wäldchen und ein Ziel', '# World building: hills from noise, a stream, a grove and a goal'], ['Genug Holz!', 'Enough wood!'],
];

/** Example of an entry in a language (or null). */
export function refExample(name, lang = 'de') {
  const ex = EXAMPLES[name] ?? WORKED[name]?.code;
  if (ex === undefined || ex === null) return null;
  if (typeof ex !== 'string') return ex[lang] ?? ex.de;
  if (lang !== 'en') return ex;
  return EN_TEXT.reduce((s, [de, en]) => s.split(de).join(en), ex);
}

/** Anchor of an entry on the reference page: the name itself (hero.step, len, str.split …). */
export const refAnchor = (name) => BASICS_ANCHOR[name] ?? name;

/** Address of the reference page (optionally at an entry), relative to the current page. */
export const refUrl = (name) => siteUrl('scripting/') + (name ? `#${encodeURIComponent(refAnchor(name))}` : '');

/**
 * Longer worked examples for the reference (chapter "examples"). adventure: solves this learning adventure
 * (checked in tests/site/scripting.test.js); level: runs as player program or mission script in the test scenario.
 */
export const WORKED = {
  adv1: { adventure: 'adv1', code: '# Abenteuer 1: zehn Schritte geradeaus\nfor i in range(10):\n    hero.step()\n' },
  adv2: { adventure: 'adv2', code: '# Abenteuer 2: um die Ecke – laufen, bis das Ziel erreicht ist\nwhile not hero.is_at(place("goal")):\n    if hero.can_step():\n        hero.step()\n    else:\n        hero.turn_right()\n' },
  adv3: { adventure: 'adv3', code: '# Abenteuer 3: die ganze Baumreihe fällen, egal wie lang sie ist\nhero.step()\nchopped = 0\nwhile hero.ahead() == "tree":\n    hero.chop()\n    chopped += 1\n    hero.step()\nprint(chopped, "Bäume gefällt")\n' },
  adv4: { adventure: 'adv4', code: '# Abenteuer 4: links und rechts nach Steinen schauen\ndef check_side(turn, back):\n    turn()\n    if hero.ahead() == "pile":\n        hero.take()\n    back()\n\nwhile hero.can_step():\n    hero.step()\n    check_side(hero.turn_left, hero.turn_right)\n    check_side(hero.turn_right, hero.turn_left)\n' },
  adv5: { adventure: 'adv5', code: '# Abenteuer 5: ein Dorf per Programm\ndef build_one(kind, helpers=3):\n    spot = find_spot(kind, hq())\n    site = build(kind, spot[0], spot[1])\n    for s in serfs(idle=True)[:helpers]:\n        s.work_on(site)\n    return site\n\nsites = [build_one("residence"), build_one("residence"), build_one("farm")]\nwait_until(lambda: all(s.done for s in sites))\nprint("Fertig nach", round(time()), "Sekunden")\n' },
  lumber: {
    level: 'player',
    code: '# Holzfäller: untätige Leibeigene an die nächsten Bäume schicken\ndef lumber(n):\n    trees = trees_near(hq(), radius=15)\n    idle = serfs(idle=True)\n    pairs = list(zip(idle[:n], trees))\n    for serf, tree in pairs:\n        serf.work_on(tree)\n    return len(pairs)\n\nstart = stock("wood")\nprint(lumber(4), "Leibeigene fällen Bäume")\nwait(30)\nprint("Nach 30 Sekunden:", stock("wood") - start, "Holz mehr")\n',
  },
  report: {
    level: 'player',
    code: '# Bestandsaufnahme: Gebäude zählen, Figuren durchlaufen\ncounts = {}\nfor b in buildings():\n    counts[b.type] = counts.get(b.type, 0) + 1\nfor kind in sorted(counts):\n    print(kind.ljust(14), counts[kind])\n\nfor t in troops():\n    d = round(t.distance_to(hq()), 1)\n    print(f"{t.type}: {t.soldiers} Soldaten, {d} Kacheln von der Burg")\n\nresources = ["wood", "clay", "stone", "iron", "sulfur", "gold"]\nrichest = max(resources, key=stock)\nprint("Am meisten:", richest, stock(richest))\n',
  },
  waves: {
    level: 'mission',
    code: '# Mission: drei Angriffswellen, danach Sieg\nobjective("hold", "Überstehe drei Angriffe")\nwaves = 0\n\n@every(60)\ndef raid():\n    global waves\n    if waves >= 3:\n        return\n    waves += 1\n    message(f"Welle {waves} kommt!")\n    attackers = spawn(BANDITS, "sword1", place("gate"), count=waves)\n    attack(attackers, hq())\n    wait_until(lambda: alive(attackers) == 0)\n    if waves == 3:\n        complete("hold")\n\n@on_objective("hold", status="done")\ndef won(id, status):\n    victory()\n\n@on_destroyed("headquarters", HUMAN)\ndef lost(kind, owner):\n    defeat("hq")\n',
  },
  world: {
    level: 'mission',
    code: '# Weltaufbau: Hügel aus Rauschen, ein Bach, ein Wäldchen und ein Ziel\nfor x in range(world.width):\n    for y in range(world.height):\n        n = world.noise(x, y, cell=12)\n        world.set_height(x, y, n // 2)\n\nfor y in range(world.height):\n    world.set_water(40, y)\n\nplant_trees(toward(hq(), map_center(), 12), 20, radius=4)\nspot = find_open(map_center(), min_r=6, max_r=20)\nmake_place("goal", spot.x, spot.y, 2)\nreveal(place("goal"))\n',
  },
};
