# Beaucroix: the merchants' quarter of the allied town at the side of the map, the bandit camp in the river forest
# towards the map centre. Never fixed coordinates: everything is searched from the castle.

home = hq()
middle = map_center()


def site(near, avoid=None):
    """Free spot reachable from the castle near `near`: first close with much room, then further with less."""
    for max_r, clear in [(10, 3), (16, 3), (16, 2), (24, 2), (30, 1)]:
        spot = find_open(near, max_r=max_r, clear=clear, reachable_from=home, avoid=avoid)
        if spot:
            return spot
    return None


# The merchants' quarter of Beaucroix (allied): the merchant stands at its market
town = player("beaucroix")
edge = world.width - 4 if home.x < middle.x else 4
quarter = site(toward(home, (edge, middle.y), 20), avoid=[(home.x, home.y, 10)])
if quarter:
    place_building(town, "storehouse", quarter, min_r=1, radius=6, level=1)
    place_building(town, "residence", (quarter.x + 4, quarter.y + 1), min_r=1, radius=6)
    make_place("townArea", quarter.x, quarter.y, 4)

# The bandit camp in the river forest, towards the map centre: it holds the second shard
robber_guards = camp("robbers", toward(home, middle, 30),
                     [("sword1", 2, 3), ("bow1", 2, 3), ("spear1", 1, 3)],
                     reachable_from=home, avoid=[(home.x, home.y, 20)])
