# III.M „Lindgrund steht wieder“ (Meisterstück der Reihe III): ein ganzes Dorf per Programm.
# Aufbau-Mission: Ausführen startet nichts neu (scenario.json "reset": false), die Unterziele gelten nebeneinander.

npc("elder", look="serf", at=place("elderSeat"))


@on_start
def intro():
    camera.jump_to(place("square"))
    say("elder", de="Das Gerücht von der Prinzessin bringt die Leute zurück. Jetzt brauchen sie ein Dorf: Dorfzentrum, zwei Wohnhäuser, zwei Höfe.",
                 en="The rumour of the princess brings the people back. Now they need a village: a village centre, two residences, two farms.")
    objective("center", lambda: (count("villageCenter"), 1),
              de="Baue das Dorfzentrum auf den alten Grundmauern wieder auf",
              en="Rebuild the village centre on the old foundations")
    objective("homes", lambda: (count("residence"), 2),
              de="Baue 2 Wohnhäuser",
              en="Build 2 residences")
    objective("farms", lambda: (count("farm"), 2),
              de="Baue 2 Bauernhöfe",
              en="Build 2 farms")
    say("elder", de="Holz und Lehm im Lager reichen dafür nicht. Neben der Burg liegen Balken aus den Trümmern und Lehm in Haufen – schick die Leibeigenen hin.",
                 en="The wood and clay in the storehouse are not enough. Next to the castle lie beams from the rubble and clay in heaps – send the serfs there.")
    wait_until(lambda: count("villageCenter") >= 1 and count("residence") >= 2 and count("farm") >= 2)
    say("elder", de="Lindgrund steht wieder. Das hätte ich nicht mehr zu sehen geglaubt.",
                 en="Lindgrund stands again. I never thought I would see that.")
    say("herald", de="Ein Herold aus Morvale! Ist hier die Prinzessin, von der alle reden? Mein Herr bittet um Hilfe.",
                  en="A herald from Morvale! Is the princess everyone talks about here? My lord asks for help.")
    victory()
