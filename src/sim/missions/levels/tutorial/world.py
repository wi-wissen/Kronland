# Practice valley: learning material near the castle – trees, a clay pile, a clay shaft – and a spot for the bandits
# within reach, but out of sight.

home = hq()
middle = map_center()

plant_trees(toward(home, middle, 9), 8, radius=3)
trees = trees_near(home, radius=48)
tree = trees[0] if trees else None

piles = piles_near(home, radius=14, res="clay")
if piles:
    pile = piles[0]
else:
    spot = find_open(toward(home, middle, 7), max_r=10)
    pile = add_pile("clay", spot.x, spot.y) if spot else None

shaft = add_shaft("clay", home, max_dist=22)
if shaft:
    make_place("shaft", shaft.x, shaft.y, 2)

hideout = find_open(toward(home, middle, 16), max_r=10, clear=2, reachable_from=home)
if hideout:
    make_place("banditSpot", hideout.x, hideout.y, 3)
else:
    make_place("banditSpot", home.x, home.y, 3)
