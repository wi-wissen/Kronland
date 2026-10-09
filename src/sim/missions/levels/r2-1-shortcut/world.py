# Drei Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9 und 18–19)
for x in range(world.width):
    for y in (8, 9, 18, 19):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Abschnitt 1: drei Mauerreste der alten Ruine auf dem Weg, südlich ist frei
for x in (3, 5, 7):
    add_pile("stone", x, 3, 60)
    add_pile("stone", x, 2, 60)
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
for x in (4, 7, 8, 12, 16):
    add_item("coin", x, 22)
for x in (5, 9, 12, 14, 18):
    add_item("coin", x, 24)
for y in range(20, 28):
    add_tree(20, y)
for x, y in [(1, 20), (9, 20), (14, 21), (3, 27), (11, 26), (16, 27)]:
    add_tree(x, y)
