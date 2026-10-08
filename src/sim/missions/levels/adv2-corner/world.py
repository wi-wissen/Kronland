# Fluss im Osten, See im Süden, Wäldchen im Westen – und mittendrin eine alte Ruine
for y in range(world.height):
    world.set_water(17, y)
    world.set_water(18, y)
for x in range(0, 17):
    world.set_water(x, 13)
    world.set_water(x, 14)
for x in range(2, 6):
    for y in range(8, 13):
        add_tree(x, y)
# Mauerreste der Ruine: oben, rechts und unten, der Eingang liegt im Westen
for x in range(6, 14):
    add_pile("stone", x, 6, 60)
for y in range(7, 11):
    add_pile("stone", 13, y, 60)
for x in range(7, 13):
    add_pile("stone", x, 10, 60)
add_pile("gold", 12, 8, 150)
