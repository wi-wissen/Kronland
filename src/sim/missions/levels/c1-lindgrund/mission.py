# Flow (also the introduction, Orrin explains): meet Orrin → old tree (prong, Orrin's lie, three serfs return)
# → beams from the rubble → village centre → houses → farms → workers; payday explains taxes; only then Malvor's
# collectors come. Whoever is further along fulfils revealed objectives at once.

met = False          # Nelia has talked to the stranger on the square
helped = False       # the neighbouring village sends people and wood
paid = False         # the first payday with workers has been explained
collectors = []      # Malvor's collectors (once they come)
elder = None         # the village elder next door (after the find)


def hauling():
    """Do serfs cut wood (at the beams or at trees)?"""
    for serf in serfs():
        if serf.res == "wood":
            return True
    return False


# ---------- Objectives (in the order of the objectives panel) ----------

objective("meet", lambda: met,
          de="Wähle Nelia aus und schick sie zum Fremden auf dem Dorfplatz",
          en="Select Nelia and send her to the stranger on the square")
hint("meet", entity=stranger)
objective("root", lambda: len(figures_near(place("oldRoot"), radius=2, kind="nelia", side="own")) > 0, hidden=True,
          de="Schick Nelia zum alten Baum am Waldrand",
          en="Send Nelia to the old tree at the edge of the forest")
hint("root", area="oldRoot")
objective("wood", lambda: met and hauling(), hidden=True,
          de="Wähle die Leibeigenen und schick sie an die Balken bei den Trümmern",
          en="Select the serfs and send them to the beams by the ruins")
hint("wood", area="ruins")
objective("center", lambda: (count("villageCenter"), 1), hidden=True,
          de="Bau das Dorfzentrum auf dem Dorfplatz wieder auf",
          en="Rebuild the village centre on the square")
hint("center", area="square", ui=["build-villageCenter", "quick-all"],
     ui_until=lambda: count("villageCenter", placed=True) >= 1)
objective("homes", lambda: (count("residence"), 2), hidden=True,
          de="Baue 2 Wohnhäuser",
          en="Build 2 residences")
hint("homes", ui=["build-residence", "quick-all"], ui_until=lambda: count("residence", placed=True) >= 2)
objective("farms", lambda: (count("farm"), 2), hidden=True,
          de="Baue 2 Bauernhöfe",
          en="Build 2 farms")
hint("farms", ui=["build-farm", "quick-all"], ui_until=lambda: count("farm", placed=True) >= 2)
objective("workers", lambda: (count("worker"), 6), hidden=True,
          de="Gib 6 Arbeitern Bett und Essen",
          en="Give 6 workers a bed and food")
hint("workers", area="clayShaft", ui=["build-clayMine", "quick-all"], ui_until=lambda: count("clayMine", placed=True) >= 1)
objective("collectors", lambda: (len(collectors) - alive(collectors), len(collectors)), hidden=True,
          de="Vertreibe Malvors Eintreiber",
          en="Drive off Malvor’s collectors")
objective("neighbors", lambda: helped, primary=False, hidden=True,
          de="Optional: Orrin soll mit der Dorfältesten nebenan reden",
          en="Optional: Have Orrin talk to the elder next door")


# ---------- Arrival ----------

@on_start
def arrival():
    say("nelia", de="Lindgrund. Kein Rauch, kein Hund, der bellt. Sie sind alle zu Malvor gegangen – für eine Schüssel Korn.",
                 en="Lindgrund. No smoke, no barking dog. They’ve all gone to Malvor – for a bowl of grain.")
    say("orrin", de="He! Du da, mit dem Bündel! Komm her zum Dorfplatz – ich beiße nicht, ich handle nur.",
                 en="Hey! You there, with the bundle! Come over to the square – I don’t bite, I only trade.")


# Orrin waits on the square; spoken to, he joins as a hero
@on_talk("stranger")
def meet_orrin(visitor):
    global met
    stranger.stop_talking()
    met = True
    say("orrin", de="Endlich ein Gesicht! Orrin, Händler in Bändern, Knöpfen und guten Ratschlägen. Mein Karrenrad ist gebrochen – und hier kauft keiner mehr.",
                 en="Finally a face! Orrin, merchant of ribbons, buttons and good advice. My cart wheel is broken – and nobody here buys anything.")
    say("nelia", de="Ich bin Nelia. Hier bin ich geboren. Ich bin aus Malvors Kornlager weggelaufen.",
                 en="I’m Nelia. I was born here. I ran away from Malvor’s granary.")
    say("orrin", de="Weggelaufen? Dann such dir Freunde, bevor er dich sucht. Ich bleibe – ein Händler ohne Kunden hat Zeit.",
                 en="Ran away? Then find friends before he finds you. I’ll stay – a merchant without customers has time.")
    say("nelia", de="Wenn die Eintreiber kamen, hat mein Vater unter dem alten Baum am Waldrand versteckt, was wir hatten. Vielleicht ist noch etwas da.",
                 en="When the collectors came, my father hid what we had under the old tree at the edge of the forest. Maybe something is still there.")
    say("orrin", de="Dann sieh nach. Der goldene Ring zeigt dir den Weg.",
                 en="Then go and look. The golden ring shows the way.")
    remove(stranger)
    add_hero(HUMAN, "orrin", place("orrinSeat"))
    show_objective("root")
    reveal(place("oldRoot"), seconds=60)


# ---------- The find at the old tree ----------

@on_objective("root", "done")
def prong(id, status):
    # The rumour of the princess reaches the neighbouring village
    global elder
    if "villageArea" in places():
        show_objective("neighbors")
        elder = npc("elder", look="serf", at=place("villageArea"), owner=player("neighbors"))
        reveal(place("villageArea"), seconds=40)
    say("nelia", de="Unter der Wurzel glänzt etwas … ein Stück Metall, wie eine Zacke. Kalt wie Eis.",
                 en="Something glitters under the root … a piece of metal, like a spike. Cold as ice.")
    say("orrin", de="Bei allen Märkten! Das ist eine Zacke der Krone! Nur das Königsblut findet so etwas!",
                 en="By all the markets! That’s a shard of the crown! Only royal blood finds such a thing!")
    say("nelia", de="Ich bin eine Leibeigene, Orrin. Mein Vater schlägt Holz.",
                 en="I’m a serf, Orrin. My father chops wood.")
    say("orrin", de="Pflegeeltern, Kind! Die Königin ertrank, aber die kleine Prinzessin … Leute! Die verlorene Prinzessin ist zurück!",
                 en="Foster parents, child! The queen drowned, but the little princess … everyone! The lost princess has returned!")
    spawn_serfs(HUMAN, 3)
    say("villager", de="Die Prinzessin! In Lindgrund! Dann wird alles gut!",
                    en="The princess! In Lindgrund! Then all will be well!")
    # Only now, quietly between the two of them: why the shard matters (and why Malvor wants it)
    say("nelia", de="Orrin! Warum erzählst du so etwas?",
                 en="Orrin! Why would you say such a thing?")
    say("orrin", de="Weil sie es glauben wollen. Und weil dieses Ding mehr wert ist als alles Korn in Malvors Speichern.",
                 en="Because they want to believe it. And because this thing is worth more than all the grain in Malvor’s storehouses.")
    say("orrin", de="König Edrians Krone zerbrach in fünf Zacken. Wer alle fünf vereint, den müssen die Provinzen krönen – so will es das alte Recht.",
                 en="King Edrian’s crown broke into five shards. Whoever unites all five must be crowned by the provinces – so the old law says.")
    say("nelia", de="Und Malvor? Er herrscht doch längst.",
                 en="And Malvor? He rules already.")
    say("orrin", de="Als Statthalter. Mit der Krone wäre er König, und keiner dürfte ihm mehr widersprechen. Glaub mir: Er sucht die Zacken auch.",
                 en="As governor. With the crown he would be king, and no one could gainsay him any more. Believe me: he is looking for the shards too.")
    say("orrin", de="Drei Leute sind schon zurückgekommen. Leibeigene tun, was man ihnen sagt: auswählen, dann zeigen, wohin.",
                 en="Three people have come back already. Serfs do what they’re told: select them, then point where.")
    say("orrin", de="Holz zuerst – ohne Holz kein Dach. Schick sie an die Trümmer der alten Häuser, die Balken dort sind trocken.",
                 en="Wood first – no wood, no roof. Send them to the ruins of the old houses, the beams there are dry.")
    show_objective("wood")


# ---------- Building up the village ----------

@on_objective("wood", "done")
def beams(id, status):
    say("orrin", de="Gut. Jetzt der Dorfplatz. Nur wo ein Dorfzentrum steht, ziehen Leute her – ohne kommt kein einziger Arbeiter.",
                 en="Good. Now the square. People only settle where a village centre stands – without one, not a single worker comes.")
    say("orrin", de="Öffne das Baumenü und setz es auf die alten Grundmauern. Wer gerade ausgewählt ist, fängt gleich an zu bauen.",
                 en="Open the build menu and set it on the old foundations. Whoever is selected starts building right away.")
    show_objective("center")


@on_objective("center", "done")
def centre(id, status):
    say("nelia", de="Das Dorfzentrum steht wieder. Wie früher.",
                 en="The village centre stands again. Like it used to.")
    say("orrin", de="Und jetzt Betten. Wer hier arbeiten soll, muss schlafen können – sonst hockt er am Lagerfeuer und schafft kaum etwas.",
                 en="And now beds. Whoever works here needs somewhere to sleep – otherwise he huddles at the campfire and gets little done.")
    show_objective("homes")


@on_objective("homes", "done")
def homes(id, status):
    say("orrin", de="Wer geschlafen hat, will essen. Bau Bauernhöfe – der Bauer ist gleich unser erster Arbeiter.",
                 en="Whoever has slept wants to eat. Build farms – and the farmer is our very first worker.")
    show_objective("farms")


@on_objective("farms", "done")
def farms(id, status):
    say("orrin", de="Arbeiter kommen von selbst, sobald es Arbeit gibt. Bau beim Lehm dort drüben eine Lehmgrube – die braucht Leute.",
                 en="Workers come on their own when there’s work. Build a clay pit by the clay over there – it needs hands.")
    show_objective("workers")
    # Only when the village lives again, Malvor's collectors come
    collectors_come()


@on_start
def first_worker():
    wait_until(lambda: count("worker") >= 1)
    say("nelia", de="Der erste Arbeiter! Wer ein Bett und eine warme Suppe hat, bleibt.",
                 en="Our first worker! Whoever has a bed and warm soup stays.")


# First payday with workers: taxes and new serfs
@on_event("payday")
def payday(income, wages):
    global paid
    if paid or count("worker") < 1:
        return
    paid = True
    say("orrin", de="Hörst du das Klimpern? Zahltag! Jeder Arbeiter zahlt Steuern – endlich Taler in Lindgrund.",
                 en="Hear that jingle? Payday! Every worker pays taxes – coin in Lindgrund at last.")
    say("orrin", de="Davon kaufst du in der Burg neue Leibeigene. Und die Steuern stellst du dort auch ein – aber drück die Leute nicht zu sehr.",
                 en="With it you buy new serfs at the castle. You set the taxes there too – but don’t squeeze the people too hard.")


# ---------- Malvor's collectors ----------

def collectors_come():
    global collectors
    if collectors:
        return
    collectors = spawn(BANDITS, "spear1", place("collectorFrom"), count=2, soldiers=2)
    attack(collectors, (home.x, home.y))
    show_objective("collectors")
    if collectors:
        reveal(collectors[0], seconds=30)
        camera.jump_to(collectors[0])
    say("collector", de="Im Namen des Statthalters! Jeder zehnte Sack Korn gehört Malvor – und was ihr unter dem alten Baum gefunden habt, auch.",
                     en="In the name of the governor! Every tenth sack of grain belongs to Malvor – and so does what you found under the old tree.")
    say("orrin", de="Eintreiber! Nelia, das sind nur ein paar Speerträger. Ruf deine Leute zusammen – und mach ihnen Mut!",
                 en="Collectors! Nelia, those are only a few spearmen. Gather your people – and rally them!")
    say("orrin", de="In der Burg rufst du „Zu den Waffen!“ – dann greifen die Leibeigenen zu Mistgabeln. Und du, Nelia, hast ein Herz, das andere mitreißt.",
                 en="At the castle you call “To arms!” – then the serfs grab their pitchforks. And you, Nelia, have a heart that carries others along.")


# After 25 minutes they come in any case
@on_start
def deadline():
    wait_until(lambda: time() >= 1500)
    collectors_come()


@on_objective("collectors", "done")
def driven_off(id, status):
    say("collector", de="Das wird Malvor erfahren! Ihr werdet um sein Korn betteln!",
                     en="Malvor will hear of this! You’ll beg for his grain!")
    say("nelia", de="Wir betteln nicht. Wir bauen.",
                 en="We don’t beg. We build.")


# ---------- The neighbouring village ----------

@on_talk("elder")
def elder_talk(visitor):
    global helped
    if visitor.name != "orrin":
        say("elder", de="Schick mir den Händler, Kind. Der redet für zwei.",
                     en="Send me the merchant, child. He talks enough for two.")
        return
    elder.stop_talking()
    say("orrin", de="Ehrwürdige Mutter! Ihr habt es gehört: Die Prinzessin ist zurück, und sie friert in Lindgrund.",
                 en="Honoured mother! You have heard: the princess has returned, and she is freezing in Lindgrund.")
    say("elder", de="Ob Prinzessin oder nicht – sie hat Malvor die Stirn geboten. Wir schicken Leute und Holz.",
                 en="Princess or not – she stood up to Malvor. We’ll send people and wood.")
    set_diplomacy(HUMAN, player("neighbors"), "allied")
    spawn_serfs(HUMAN, 3)
    give(HUMAN, wood=300)
    helped = True
