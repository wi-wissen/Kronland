# Flow: without a castle into the valley – through the heavily guarded gate or over the frozen river in the gorge
# (a small outpost: fight it or let Orrin bribe a squad). The weatherworks stands on the island in the lake. Once it
# is destroyed, it thaws after 60 seconds – then Nelia and Orrin must stand on firm valley floor, not on the ice and
# not on the island. Hrimgar's plan fragments lie in the ruins at the valley edge.

THAW_AFTER = 60       # seconds between the fall of the weatherworks and the thaw
thaw_from = None      # time the weatherworks fell
thawed = False        # the thaw is over and both stood on firm ground
seen = []             # sights already commented on


def gone(units):
    """How many of these troops are no longer against us (fallen or switched to our side)?"""
    n = 0
    for unit in units:
        if not unit.alive or unit.owner == HUMAN:
            n += 1
    return n


def first_time(sight):
    """True the first time a sight is reached."""
    if sight in seen:
        return False
    seen.append(sight)
    return True


def footing(hero):
    """Where does a hero stand at the thaw? "ice" (water), "island" or "firm"."""
    if world.is_water(hero.x, hero.y):
        return "ice"
    if (hero.x - isle.x) ** 2 + (hero.y - isle.y) ** 2 <= (isle.r + 1) ** 2:
        return "island"
    return "firm"


# ---------- Objectives (in the order of the objectives panel) ----------

objective("works", lambda: works is not None and not works.alive,
          de="Zerstöre das Wetterwerk auf der Insel",
          en="Destroy the weatherworks on the island")
if works:
    hint("works", entity=works)
objective("escape", lambda: (min(THAW_AFTER, int(time() - thaw_from)), THAW_AFTER, thawed), hidden=True, clock=True,
          de="Tauwetter! Bring Nelia und Orrin auf festen Talboden – runter vom Eis und von der Insel",
          en="Thaw! Get Nelia and Orrin onto firm valley ground – off the ice and off the island")
hint("escape", area="landing")
objective("plans", lambda: len(units_in(place("ruinsArea"), who="hero")) > 0,
          de="Sichere Hrimgars Bauplan-Bruchstücke in den Ruinen am Talrand",
          en="Secure Hrimgar’s plan fragments in the ruins at the valley edge")
objective("heroes", lambda: alive(heroes) > 0, hold=True,
          de="Nelia und Orrin dürfen nicht beide fallen",
          en="Nelia and Orrin must not both fall")
# Appears only once the camp is in sight: then Nelia says what it is for
objective("prisoners", lambda: (gone(prison_guards), len(prison_guards)), primary=False, hidden=True,
          de="Optional: Vertreibe die Wachen am Gefangenenlager – die Befreiten kämpfen mit dir",
          en="Optional: Drive off the guards at the prison camp – the freed prisoners will fight with you")
if "prison" in places():
    hint("prisoners", area="prison")

reveal(place("gate"), seconds=20)
camera.jump_to(place("gate"))


@on_start
def arrival():
    say("orrin", de="Kein Dach, kein Feuer, kein Markt. Ich hasse Abenteuer.",
                 en="No roof, no fire, no market. I hate adventures.")
    say("nelia", de="Hinter dem Kamm liegt das Tal. Das Tor ist zu stark für uns. Aber der Fluss ist zugefroren …",
                 en="Beyond the ridge lies the valley. The gate is too strong for us. But the river is frozen …")
    say("orrin", de="Und an der Schlucht steht sicher auch jemand. Schau mit deinem Weitblick nach, bevor wir hineinlaufen.",
                 en="And surely someone stands guard at the gorge too. Use your farsight before we walk in.")
    say("orrin", de="Und merk dir eins: Fällt das Werk, taut der See. Dann müssen wir schnell runter vom Eis.",
                 en="And remember one thing: once the works falls, the lake thaws. Then we have to get off the ice fast.")


# ---------- On the way ----------

@on_enter(place("gorge"), who="army")
def gorge_seen(who):
    if first_time("gorge"):
        say("orrin", de="Nur zwei Trupps am Ausgang der Schlucht. Für 350 Taler wechselt einer davon die Seiten – glaub mir.",
                     en="Only two squads at the end of the gorge. For 350 thalers one of them will switch sides – trust me.")


@on_enter(place("gate"), who="army")
def gate_seen(who):
    if first_time("gate"):
        say("nelia", de="Ein Turm und fünf Trupps. Wenn wir hier durchwollen, brauchen wir Mut – viel Mut.",
                     en="A tower and five squads. If we want through here, we need courage – a lot of courage.")


if "prisonSight" in places():
    @on_enter(place("prisonSight"), who="army")
    def prison_seen(who):
        if not first_time("prison"):
            return
        reveal(place("prison"), seconds=30)
        show_objective("prisoners")
        say("nelia", de="Da drüben, ein Lager mit Gefangenen – Leute aus den Dörfern. Vertreiben wir die Wachen, kämpfen sie mit uns.",
                     en="Over there, a camp with prisoners – people from the villages. If we drive off the guards, they will fight with us.")


@on_objective("prisoners", "done")
def freed(id, status):
    spawn(HUMAN, "spear1", place("prison"), count=2, soldiers=3)
    say("villager", de="Ihr seid die Leute aus Lindgrund? Wir kämpfen mit euch!",
                    en="You are the people from Lindgrund? We’ll fight with you!")
    say("orrin", de="Zwei Trupps Speerträger mehr. Die können wir am Wetterwerk gut gebrauchen.",
                 en="Two more squads of spearmen. We can put them to good use at the weatherworks.")


@on_enter(place("valley"), who="army")
def valley_seen(who):
    if first_time("valley"):
        reveal(place("isle"), seconds=30)
        say("nelia", de="Da ist es, mitten im See. Das Eis trägt uns hin – Hrimgars Winter bringt uns zu seinem eigenen Werk.",
                     en="There it is, in the middle of the lake. The ice will carry us – Hrimgar’s winter brings us to his own works.")


# At the works the gate guard is called to the lake
@on_enter(place("isle"), who="army")
def alarm(who):
    if not first_time("isle"):
        return
    attack(spawn(BANDITS, [("sword1", 2, 4), ("bow1", 1, 3)], place("gateCamp")), place("isle"))
    say("guard", de="Alarm! Eindringlinge am Werk! Wache vom Tor, zum See!",
                 en="Alarm! Intruders at the works! Gate guard, to the lake!")


# ---------- The weatherworks falls: the thaw ----------

@on_objective("works", "done")
def works_down(id, status):
    say("nelia", de="Es ist still. Hörst du? Das Brummen ist weg … und das Eis knackt.",
                 en="It’s quiet. Hear that? The humming is gone … and the ice is cracking.")
    say("orrin", de="Runter vom See! In einer Minute ist das hier Wasser!",
                 en="Off the lake! In a minute this will all be water!")


@on_objective("works", "done")
def cut_off(id, status):
    wait(5)
    attack(spawn(BANDITS, "spear1", place("gateCamp"), count=2, soldiers=3), place("landing"))
    say("guard", de="Das Werk brennt! Fangt sie am Ufer ab, bevor sie entkommen!",
                 en="The works is burning! Catch them at the shore before they escape!")


@on_objective("works", "done")
def thaw_soon(id, status):
    wait(THAW_AFTER - 15)
    say("orrin", de="Das Eis wird grau! Lauf, Nelia!",
                 en="The ice is turning grey! Run, Nelia!")


@on_objective("works", "done")
def thaw(id, status):
    global thaw_from, thawed
    thaw_from = time()
    show_objective("escape")
    wait(THAW_AFTER)
    # Whoever stands on the ice or on the island now loses
    for hero in heroes:
        where = footing(hero)
        if where != "firm":
            defeat(where)
            return
    set_weather("summer", 3600)
    thawed = True


@on_objective("plans", "done")
def plans(id, status):
    say("orrin", de="Zeichnungen von Türmen, Röhren, Zahlen … das ist mehr wert als mein ganzer Karren.",
                 en="Drawings of towers, pipes, numbers … this is worth more than my whole cart.")
    say("nelia", de="Dann pass gut darauf auf. Vielleicht brauchen wir sie noch.",
                 en="Then take good care of them. We might need them yet.")
