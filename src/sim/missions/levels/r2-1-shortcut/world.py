# Drei Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9 und 18–19).
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird – der Normalfall und zwei Randfälle.
for x in range(world.width):
    for y in (8, 9, 18, 19):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Je Welt: wo südlich der Ruine ein Baum Orrins Umweg versperrt (Abschnitt 1), wo der Waldrand am Weg steht und wo
# Orrins Taler liegen (Abschnitt 3). „Ganz nah“: Baum gleich beim ersten Umweg, kurzer Weg, Taler schon beim ersten
# Schritt auf beiden Seiten. „Weit weg“: Baum erst beim dritten Umweg, langer Weg, Taler fast nur rechts, der letzte
# ganz am Ende.
TREE = {"normal": None, "near": (4, 4), "far": (8, 4)}[world.id]
FOREST = {"normal": 20, "near": 9, "far": 22}[world.id]
COINS_LEFT = {"normal": [4, 7, 8, 12, 16], "near": [3, 8], "far": [21]}[world.id]
COINS_RIGHT = {"normal": [5, 9, 12, 14, 18], "near": [3, 5], "far": [6, 10, 11, 15, 19, 21]}[world.id]

# Abschnitt 1: drei Mauerreste der alten Ruine auf dem Weg, südlich ist frei (außer TREE)
for x in (3, 5, 7):
    add_pile("stone", x, 3, 60)
    add_pile("stone", x, 2, 60)
if TREE:
    add_tree(TREE[0], TREE[1])
for x, y in [(1, 0), (10, 1), (15, 0), (21, 2), (0, 7), (12, 6), (18, 7), (22, 5)]:
    add_tree(x, y)

# Abschnitt 2: dieselben Mauerreste, aber im Süden wächst eine Dornenhecke
for x in (3, 5, 7):
    add_pile("stone", x, 13, 60)
for x in range(1, 11):
    add_tree(x, 14)
for x, y in [(1, 10), (10, 11), (15, 10), (21, 12), (4, 17), (12, 16), (18, 17), (22, 15)]:
    add_tree(x, y)

# Abschnitt 3: Orrins verlorene Taler links (Reihe 22) und rechts (Reihe 24) vom Weg, am Ende ein Waldrand
for x in COINS_LEFT:
    add_item("coin", x, 22)
for x in COINS_RIGHT:
    add_item("coin", x, 24)
for y in range(20, 28):
    add_tree(FOREST, y)
for x, y in [(1, 20), (9, 20), (14, 21), (3, 27), (11, 26), (16, 27)]:
    if x < FOREST:
        add_tree(x, y)
