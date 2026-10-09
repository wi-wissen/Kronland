# Vier Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9, 18–19 und 28–29)
for x in range(world.width):
    for y in (8, 9, 18, 19, 28, 29):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Abschnitt 1: eine Reihe verlorener Taler direkt vor Nelia
for x in range(3, 10):
    add_item("coin", x, 3)
for x, y in [(1, 0), (6, 0), (12, 1), (18, 0), (23, 2), (0, 7), (9, 7), (15, 6), (21, 7)]:
    add_tree(x, y)

# Abschnitt 2: Taler und Christrosen gemischt, am Ende ein Baum
row = ["coin", "coin", "flower", "coin", "flower", "coin", "coin", "flower", "coin", "coin"]
for i in range(len(row)):
    add_item(row[i], 3 + i, 13)
add_tree(13, 13)
for x, y in [(1, 10), (7, 11), (14, 10), (19, 11), (24, 10), (4, 16), (10, 17), (17, 16), (22, 17)]:
    add_tree(x, y)

# Abschnitt 3: der Bach im Osten
for y in range(20, 28):
    world.set_water(12, y)
    world.set_water(13, y)
for x, y in [(1, 20), (6, 21), (9, 26), (3, 27), (16, 21), (20, 25), (23, 22)]:
    add_tree(x, y)

# Abschnitt 4: eine lange Talerreihe – sechs davon reichen
for x in range(3, 13):
    add_item("coin", x, 33)
for x, y in [(1, 30), (7, 31), (15, 30), (20, 32), (3, 37), (11, 36), (18, 37), (24, 35)]:
    add_tree(x, y)
