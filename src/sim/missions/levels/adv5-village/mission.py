@on_start
def intro():
    camera.jump_to(hq())
    objective("homes", lambda: (count("residence"), 2),
              de="Baue 2 Wohnhäuser",
              en="Build 2 residences")
    objective("farm", lambda: count("farm") >= 1,
              de="Baue einen Bauernhof",
              en="Build a farm")
    say("ottilie", de="Zwei Wohnhäuser und ein Bauernhof – aber diesmal mit einem Programm, bitte!",
                   en="Two residences and a farm – but this time with a program, please!")
    wait_until(lambda: count("residence") >= 2 and count("farm") >= 1)
    say("ottilie", de="Wunderbar! Das schreibe ich in die Chronik.",
                   en="Wonderful! I will write that in the chronicle.")
    victory()
