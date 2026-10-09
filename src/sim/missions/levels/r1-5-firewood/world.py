# Vier Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9, 18–19 und 28–29).
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird – der Normalfall und zwei Randfälle.
for x in range(world.width):
    for y in (8, 9, 18, 19, 28, 29):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Je Welt: verlorene Taler vor Nelia (Abschnitt 1), Taler und Christrosen bis zum Baum (2), Schritte bis zum Bach (3),
# Taler in der langen Reihe (4). „Ganz nah“: ein einziger Taler, der Baum direkt vor Nelia, das Eis direkt vor ihr,
# genau sechs Taler. „Weit weg“: lange Reihen, der Bach weit im Osten.
ROW = {"normal": 7, "near": 1, "far": 12}[world.id]
MIXED = {
    "normal": ["coin", "coin", "flower", "coin", "flower", "coin", "coin", "flower", "coin", "coin"],
    "near": [],
    "far": ["flower", "coin", "coin", "flower", "flower", "coin", "coin", "coin", "flower", "coin", "coin", "flower",
            "coin", "coin", "coin", "flower"],
}[world.id]
BROOK = {"normal": 9, "near": 0, "far": 17}[world.id]
SIX_ROW = {"normal": 10, "near": 6, "far": 18}[world.id]

# Abschnitt 1: eine Reihe verlorener Taler direkt vor Nelia
for x in range(3, 3 + ROW):
    add_item("coin", x, 3)
for x, y in [(1, 0), (6, 0), (12, 1), (18, 0), (23, 2), (0, 7), (9, 7), (15, 6), (21, 7)]:
    add_tree(x, y)

# Abschnitt 2: Taler und Christrosen gemischt, am Ende ein Baum („ganz nah“ steht er direkt vor Nelia)
for i in range(len(MIXED)):
    add_item(MIXED[i], 3 + i, 13)
add_tree(3 + len(MIXED), 13)
for x, y in [(1, 10), (7, 11), (14, 10), (19, 11), (24, 10), (4, 16), (10, 17), (17, 16), (22, 17)]:
    add_tree(x, y)

# Abschnitt 3: der Bach im Osten, zugefroren – BROOK Schritte von Nelia entfernt
for y in range(20, 28):
    world.set_water(3 + BROOK, y)
    world.set_water(4 + BROOK, y)
for x, y in [(1, 20), (6, 21), (9, 26), (3, 27), (16, 21), (20, 25), (23, 22)]:
    if x != 3 + BROOK and x != 4 + BROOK:
        add_tree(x, y)

# Abschnitt 4: eine lange Talerreihe – sechs davon reichen
for x in range(3, 3 + SIX_ROW):
    add_item("coin", x, 33)
for x, y in [(1, 30), (7, 31), (15, 30), (20, 32), (3, 37), (11, 36), (18, 37), (24, 35)]:
    add_tree(x, y)
