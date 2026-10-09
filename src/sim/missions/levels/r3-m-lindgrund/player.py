# Mein Programm: Listen von Leibeigenen und Haufen
helpers = serfs()
print(len(helpers), "Leibeigene")
piles = piles_near(hq(), 12, "wood")
print(len(piles), "Holzhaufen in der Nähe")
spot = find_spot("residence", hq())
print("Bauplatz für ein Wohnhaus:", spot)
