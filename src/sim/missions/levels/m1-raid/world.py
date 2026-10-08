# Lager zwischen Burg und Kartenmitte, Sammelpunkt der Angreifer davor
spot = find_open(toward(hq(), map_center(), 30), max_r=12)
make_place("camp", spot.x, spot.y, 6)
clear_area(place("camp"), 4)
place_building(BANDITS, "banditCamp", place("camp"))
guards = spawn(BANDITS, "spear1", place("camp"), count=2, soldiers=3)
gate = toward(place("camp"), hq(), 8)
make_place("gate", gate.x, gate.y, 3)
