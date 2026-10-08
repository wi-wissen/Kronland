@on_start
def intro():
    objective("goal", lambda: hero.is_at(place("goal")),
              de="Erreiche das Innere der Ruine",
              en="Reach the inside of the ruin")
    say("nelia", de="Geradeaus, bis etwas im Weg ist – dann rechts herum. So komme ich bestimmt in die Ruine.",
                 en="Straight ahead until something is in the way – then turn right. That way I will surely get into the ruin.")
    wait(60)
    if not hero.is_at(place("goal")):
        message(de="Tipp: while not hero.is_at(place(\"goal\")):  →  darin if hero.can_step(): … else: …",
                en="Tip: while not hero.is_at(place(\"goal\")):  →  inside: if hero.can_step(): … else: …")

@on_objective("goal")
def arrived(id, status):
    say("nelia", de="Geschafft! Und ich habe mir keinen einzigen Schritt merken müssen.",
                 en="Made it! And I did not have to remember a single step.")
    victory()
