# Lindgrund nach dem Winter der Flucht: vom Dorfzentrum stehen nur die Grundmauern, neben der Burg liegen Balken
# aus den Trümmern, Lehm gibt es in Haufen. Gesucht wird alles von der Burg aus – keine festen Koordinaten.

home = hq()

# Das Dorfzentrum ist verfallen: der Bauplatz bleibt
centres = buildings("villageCenter")
if centres:
    old = centres[0]
    make_place("square", old.x, old.y, 3)
    remove(old)
else:
    make_place("square", home.x + 6, home.y, 3)

# Balken aus den Trümmern: zwei Holzhaufen nahe der Burg
for corner in [(home.x - 5, home.y + 5), (home.x + 5, home.y + 5)]:
    spot = find_open(corner, max_r=8, clear=1, reachable_from=home)
    if spot:
        add_pile("wood", spot.x, spot.y, 400)

# Die Älteste wartet neben den Grundmauern
seat = find_open((place("square").x - 3, place("square").y + 3), max_r=6, reachable_from=home)
if seat:
    make_place("elderSeat", seat.x, seat.y, 0)
else:
    make_place("elderSeat", home.x + 3, home.y + 3, 0)
