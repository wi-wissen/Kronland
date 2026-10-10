# Eine Straße nach Osten, drei Wegstücke einer Reise: die Ruine mit ihren sechs Mauerresten (Etappen „predict“ und
# „hedge“: je drei Umwege um die Mauern), dahinter die Straße bis zum Wald, auf der Orrins Taler verstreut liegen
# (Etappe „coins“). Die Hecke wächst erst bei Etappe 2 (grow_hedge, mission.py) – ein Spielstart bei Etappe 2 oder 3
# baut sie gleich mit.
# Drei Welten (scenario.json "worlds"): die Ruine ist in jeder gleich, die Straße dahinter nicht. „Ganz nah“: kurzer
# Weg bis zum Wald, Taler schon beim ersten Schritt auf beiden Seiten. „Weit weg“: langer Weg, Taler fast nur rechts, der
# letzte ganz am Ende.

ROAD = 5   # die Reihe der Straße; links vom Weg (Norden) ist Reihe 4, rechts (Süden) Reihe 6
FOREST = {"normal": 32, "near": 21, "far": 34}[world.id]
COINS_LEFT = {"normal": [16, 19, 20, 24, 28], "near": [15, 20], "far": [33]}[world.id]
COINS_RIGHT = {"normal": [17, 21, 24, 26, 30], "near": [15, 17], "far": [18, 22, 23, 27, 31, 33]}[world.id]

make_place("start", 2, ROAD, 0)
make_place("ruin_end", 14, ROAD, 0)
make_place("view_ruin", 10, ROAD, 6)
make_place("view_road", 24, ROAD, 6)


# Die Dornenhecke südlich der zweiten Hälfte der Ruine: versperrt den Umweg nach rechts (Süden)
def grow_hedge():
    for x in range(8, 15):
        add_tree(x, ROAD + 1)


# Die Ruine: sechs Mauerreste auf der Straße (zwischen ihnen je eine freie Kachel), ein paar Steine daneben
for x in (3, 5, 7, 9, 11, 13):
    add_pile("stone", x, ROAD, 60)
for x, y in [(4, 2), (10, 2), (6, 8), (12, 8), (16, 9)]:
    add_pile("stone", x, y, 40)

# Orrins Taler links (Norden) und rechts (Süden) von der Straße hinter der Ruine
for x in COINS_LEFT:
    add_item("coin", x, ROAD - 1)
for x in COINS_RIGHT:
    add_item("coin", x, ROAD + 1)

# Der Wald am Ende der Straße: ein Streifen, drei Bäume breit
for y in range(0, 11):
    for x in range(FOREST, FOREST + 3):
        add_tree(x, y)

# Einzelne Bäume – nie auf der Straße und den Reihen links und rechts davon
for x, y in [(1, 0), (6, 1), (15, 0), (21, 2), (0, 8), (9, 9), (18, 8), (23, 1), (27, 9), (29, 2), (3, 9), (13, 0), (20, 9),
             (25, 0), (30, 8), (1, 3), (8, 7), (14, 7), (22, 7), (26, 8), (31, 3), (5, 7), (17, 2), (12, 3), (2, 8)]:
    if (y < ROAD - 1 or y > ROAD + 1) and (x < FOREST or x >= FOREST + 3):
        add_tree(x, y)

# Spielstart: Nelia steht am Anfang der Straße; bei Etappe 2 und 3 schon dort, wo die vorige endet – im Weltaufbau
# gesetzt, also vor dem ersten Takt und ohne Weg
if world.stage == "hedge" or world.stage == "coins":
    grow_hedge()
if world.stage == "hedge":
    nelia.teleport((8, ROAD))
if world.stage == "coins":
    nelia.teleport(place("ruin_end"))
