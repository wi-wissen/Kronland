import random
# Taler links (y = 4) und rechts (y = 6) des Wegs, zufällig verteilt; im Osten endet der Weg am Bach
for x in range(5, 24):
    if random.random() < 0.35:
        add_item("coin", x, 4)
    if random.random() < 0.35:
        add_item("coin", x, 6)
for y in range(world.height):
    world.set_water(25, y)
    world.set_water(26, y)
for x, y in [(2, 1), (3, 1), (11, 0), (12, 1), (19, 1), (2, 9), (8, 10), (15, 9), (16, 10), (22, 9)]:
    add_tree(x, y)
