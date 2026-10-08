## What scripts can do {#intro}

Kronland can be programmed – in [Python](https://en.wikipedia.org/wiki/Python_%28programming_language%29), or more
precisely in a small subset of it that runs right inside the game (“Kronland Python”). Programs appear in three places:

- **Coding adventures** (start menu → **Coding adventures**): you steer the heroine Nelia across a meadow with code,
  fell trees, collect stones and finally build a whole village. Every adventure introduces something new:
  {{adventures}}.
- **Mission scripts**: the course of a mission – dialogues, camera flights, attack waves, objectives, victory and
  defeat – is itself a Python program. The example mission “The Raid” is written entirely that way.
- **World editor**: build your own maps and turn them into your own adventures with mission and player sections.

There are two **permission levels**. Player programs (coding adventures) may only do what you can do with the mouse –
every command goes through the same rules, costs the same resources and is refused in the same way. Mission scripts
may do anything: create troops, give away resources, shape the terrain. In the reference below, commands that only
exist in mission scripts are marked **mission only**.

The command names are English (`nelia.step()`, `stock("wood")`); explanations and error messages are available in
German and English. Kronland Python produces the same output as “real” Python for the same programs – automated
tests compare this.

> **Try it:** all examples for the built-in functions (section [Built-in functions](#ref-pyfunc) and following) run
> here on the page in the same machine as in the game – the **output** shown is real. Examples with game commands run
> in the game; an automated test checks every one of them on a test map.

## Opening the editor {#editor}

1. Start menu → **Coding adventures** → choose an adventure → **Start mission**.
2. The **code panel** with your program appears on the right; on a phone you open it with the golden **Code** coin.
3. Type code and press **Run**. Below the code is the **console** with everything `print()` outputs.

| Button | Effect |
|---|---|
| **Run** | starts the program from the beginning |
| **Stop** | ends it (the hero stops) |
| **Step** | executes one statement, also into functions |
| **Over** | next line – function calls run in one go |
| **Out** | continue until the current function is finished |
| **Continue** / **Pause** | run to the next breakpoint or pause |

Tapping a **line number** sets a [breakpoint](https://en.wikipedia.org/wiki/Breakpoint). When the program halts, the
line turns green and you see global, passed and local variables and the call stack – a small
[debugger](https://en.wikipedia.org/wiki/Debugger). Hovering over a command (on a phone: long press) shows a card
explaining it; the **Reference** button opens this page. The **# Grid** button shows the tiles so you can count steps. Your code is
remembered in the browser. More about the controls in the [manual](manual/#coding).

In the **world editor** (Coding adventures → World editor) the **Code** tab holds all sections of a scenario:
mission sections (everything allowed) and player sections (like the interface).

## How a program runs {#run}

**Translating.** When you run a program, a [lexer](https://en.wikipedia.org/wiki/Lexical_analysis) splits the text
into words and symbols and recognises the indentation, a [parser](https://en.wikipedia.org/wiki/Parsing) builds a
syntax tree from them, and a [compiler](https://en.wikipedia.org/wiki/Compiler) turns that into
[bytecode](https://en.wikipedia.org/wiki/Bytecode): simple instructions like “load variable”, “add”, “call”. Typos are
already caught here – an unknown name is reported before anything runs.

**Executing.** The bytecode is executed by a [virtual machine](https://en.wikipedia.org/wiki/Virtual_machine) of its
own, a [stack machine](https://en.wikipedia.org/wiki/Stack_machine). It can stop after every single instruction and
continue exactly there. That is why `nelia.step()` can simply “wait” in the code until the hero has arrived, while the
game keeps running.

**In step with the game.** The game computes in fixed **ticks**: {{ticks}} per second of game time. In every tick a
program may execute a limited number of bytecode instructions (the **budget**):

| What | Instructions per tick |
|---|---|
| player program (coding adventure) | {{budgetPlayer}} |
| all mission scripts together | {{budgetMission}} |
| world building when the map loads (once) | {{budgetSetup}} |
| a condition (`wait_until`, `objective`, `sorted(key=…)`) in one go | {{syncLimit}} |

When the budget is used up, the program continues in the next tick. An
[infinite loop](https://en.wikipedia.org/wiki/Infinite_loop) without `wait` therefore does **not** freeze the game – it
just never finishes; end it with **Stop**. Only a condition that never finishes is aborted with “This takes too long”.
Functions may call themselves ([recursion](https://en.wikipedia.org/wiki/Recursion_%28computer_science%29)), but at
most {{maxDepth}} calls deep.

**Waiting.** Commands that take time in the game pause the program until they are done: `wait()`, `wait_until()`,
`nelia.step()`, `nelia.move_to()`, `nelia.turn_left()`, `nelia.take()`, `say()`, `camera.fly_to()` … Commands like
`build()` or `serf.work_on()`, on the other hand, only give the order and return at once.

**Tasks.** The main program and every event function (`@every`, `@on_enter` …) run side by side as separate
**tasks**, always in a fixed order. If one waits, the others carry on.

**Deterministic.** The same program on the same map always does exactly the same
([deterministic algorithm](https://en.wikipedia.org/wiki/Deterministic_algorithm)): there is no clock time, the
[randomness](https://en.wikipedia.org/wiki/Pseudorandom_number_generator) of `random` is predictable and saved along,
and [floats](https://en.wikipedia.org/wiki/Floating-point_arithmetic) compute bit for bit the same on every machine.
That is why a game can be saved and loaded in the middle of a running program, and the program continues exactly there.

## The language {#language}

Kronland Python knows the most important parts of Python. The examples with **output** run here on the page.

### Comments and statements {#lang-comments}

Everything after `#` is a [comment](https://en.wikipedia.org/wiki/Comment_%28computer_programming%29) and is
skipped. Every line is a [statement](https://en.wikipedia.org/wiki/Statement_%28computer_science%29); several fit
on one line with `;`. Blocks (after `if`, `for`, `def` …) start with a colon and are **indented** – usually 4 spaces
([off-side rule](https://en.wikipedia.org/wiki/Off-side_rule)). Tabs and spaces must not be mixed.

```py
# This is a comment
a = 1; b = 2
if a < b:
    print("a is smaller")  # indented: belongs to the if
```

### Output with print {#lang-print}

`print()` writes values to the console, separated by spaces.

```py
print("Hello, Kronland!")
print("Wood:", 120, "Stone:", 40)
```

### Variables {#lang-variables}

A [variable](https://en.wikipedia.org/wiki/Variable_%28high-level_programming_language%29) is a name for a value.
`=` gives it a (new) value, `+=`, `-=`, `*=` … change it. Names consist of letters, digits and `_`, not starting with a
digit; case matters. Several values can be assigned and swapped at once.

```py
wood = 120
wood += 30
x, y = 4, 7
x, y = y, x
first, *rest = [1, 2, 3]
print(wood, x, y, first, rest)
```

### Numbers and arithmetic {#lang-numbers}

[Integers](https://en.wikipedia.org/wiki/Integer_%28computer_science%29) (`int`, arbitrarily large) and floats
(`float`, with a point: `2.5`). Truth values are `True` and `False`, “nothing” is `None`.

| Operator | Meaning | Example |
|---|---|---|
| `+ - *` | plus, minus, times | `3 * 4` → `12` |
| `/` | divided (always a float) | `7 / 2` → `3.5` |
| `//` `%` | integer division, remainder | `7 // 2` → `3`, `7 % 2` → `1` |
| `**` | power | `2 ** 10` → `1024` |
| `== != < > <= >=` | comparisons (also chained: `1 < x < 5`) | `3 == 3` → `True` |
| `and or not` | and, or, not | `x > 0 and x < 9` |
| `in`, `not in` | contained | `"a" in "Kranz"` |
| `is`, `is not` | same object (for `None`) | `x is None` |
| `& ^ ~ << >>` | bit operations (and, exclusive or, not, shift) | `5 & 3` → `1` |

```py
print(7 / 2, 7 // 2, 7 % 2, -7 // 2)
print(2 ** 100)
print(0.1 + 0.2, round(0.1 + 0.2, 2))
print(1 < 3 < 5, not True, None is None)
```

### Texts and f-strings {#lang-strings}

[Texts](https://en.wikipedia.org/wiki/String_%28computer_science%29) are written in `"…"` or `'…'`, multi-line in
`"""…"""`. `+` joins them, `*` repeats, `[i]` gets a character, `[a:b]` a slice. An **f-string** (`f"…"`) inserts
values in `{}` directly, with a format spec after `:`. There is also `"%d wood" % 5` and [`str.format`](#str.format).

```py
name = "Nelia"
wood = 120.456
print("Hello " + name + "!", name * 2)
print(name[0], name[-1], name[1:3], len(name))
print(f"{name} has {wood:.1f} wood, {wood:>8.2f}|")
print("Line 1\nLine 2\twith tab")
```

### Conditions: if, elif, else {#lang-if}

With a [conditional](https://en.wikipedia.org/wiki/Conditional_%28computer_programming%29) a block only runs if the
condition is true. `elif` checks further, `else` catches the rest. `0`, `""`, empty lists and `None` also count as
false. Short form: `a if condition else b`.

```py
wood = 80
if wood >= 100:
    print("enough wood")
elif wood >= 50:
    print("almost enough")
else:
    print("too little")
print("full" if wood > 200 else "room left")
```

### Loops: while {#lang-while}

A [loop](https://en.wikipedia.org/wiki/Loop_%28statement%29) repeats a block. `while` repeats **as long as** the
condition is true. `break` ends the loop at once, `continue` jumps to the next round; an `else` block runs if the loop
finished without `break`.

```py
n = 1
while n < 100:
    n = n * 2
print(n)
```

Typical in the game: `while nelia.can_step(): nelia.step()` – walk until something is in the way.

### Loops: for and range {#lang-for}

`for` walks through the elements of a sequence: a list, a text, a dictionary (its keys) or `range(…)` for numbers.

```py
for i in range(3):
    print("Round", i)
for res in ["wood", "stone"]:
    print(res.upper())
for i, c in enumerate("abc"):
    if c == "b":
        continue
    print(i, c)
else:
    print("done")
```

### Functions {#lang-def}

A [function](https://en.wikipedia.org/wiki/Function_%28computer_programming%29) is a named block that receives
[parameters](https://en.wikipedia.org/wiki/Parameter_%28computer_programming%29) and gives back a result with
`return` (without `return`: `None`). Parameters can have default values and be passed by name; `*args` collects
further values, `**kwargs` further named ones. Functions are values: they can be passed around (as in adventure 4) –
or written briefly as a [`lambda`](https://en.wikipedia.org/wiki/Anonymous_function). Inner functions see the
variables outside ([closure](https://en.wikipedia.org/wiki/Closure_%28computer_programming%29)); `global` and
`nonlocal` let you change them.

```py
def cost(n, price=50):
    return n * price

print(cost(3), cost(3, price=20))

def total(*amounts, **extra):
    return sum(amounts) + sum(extra.values())

print(total(1, 2, 3, gold=10))

double = lambda x: x * 2
print(list(map(double, [1, 2, 3])))

count = 0
def tick():
    global count
    count += 1
tick(); tick()
print(count)
```

### Lists {#lang-lists}

A [list](https://en.wikipedia.org/wiki/List_%28abstract_data_type%29) holds several values in order. Counting starts
at 0, negative indices count from the back. Slices (`xs[1:3]`, `xs[::-1]`) return new lists. A **list
comprehension** builds a list in one line. Game commands like `serfs()` or `trees_near()` return lists.

```py
xs = [3, 1, 4, 1, 5]
xs.append(9)
print(xs[0], xs[-1], xs[1:3], len(xs))
print(sorted(xs), xs[::-1])
print([x * x for x in xs if x > 2])
print(4 in xs, xs.count(1))
del xs[0]
print(xs)
```

### Tuples {#lang-tuples}

[Tuples](https://en.wikipedia.org/wiki/Tuple) are immutable lists in round brackets – ideal for coordinates.
`find_spot()`, for example, returns a tuple `(x, y)`, and a tuple may stand wherever a target is expected.

```py
spot = (12, 7)
x, y = spot
print(spot, x, y, spot[0])
print((1, 2) + (3,))
```

### Dictionaries {#lang-dicts}

A dictionary (`dict`, an [associative array](https://en.wikipedia.org/wiki/Associative_array)) stores values under
**keys**. A missing key gives a `KeyError` – with `get` a fallback comes back instead.

```py
stock = {"wood": 120, "stone": 40}
stock["gold"] = 300
stock["wood"] -= 20
print(stock["wood"], stock.get("iron", 0), len(stock))
for res, n in stock.items():
    print(res, n)
print({r: n * 2 for r, n in stock.items()})
```

### Modules: math and random {#lang-import}

`import` loads a module. There are exactly two: [`math`](#ref-pymath) and [`random`](#ref-pyrandom).
`from math import sqrt` fetches single names, `import math as m` gives a short name.

```py
import math
from random import randint, seed
seed(1)
print(math.sqrt(2), math.floor(2.7), randint(1, 6))
```

### Decorators and events {#lang-decorators}

In mission scripts a decorator like `@every(10)` or `@on_start` registers the following function for an
[event](https://en.wikipedia.org/wiki/Event_%28computing%29) – see [Events](#ref-events).

```
@on_building_done("farm")
def farm_ready(building):
    say("nelia", "The farm is finished!")
```

## What is (not yet) there {#missing}

Kronland Python is deliberately small. Whatever is missing is reported by the compiler with an understandable message
(“This does not exist in Kronland Python (yet)”):

| From Python | In Kronland | Instead |
|---|---|---|
| `class` (own classes) | not available | dictionaries and functions; game objects come ready-made |
| `try` / `except` / `finally`, `raise` | not available – an error ends the program | check first: `if nelia.can_step():`, `d.get(k)`, `x in xs` ([exception handling](https://en.wikipedia.org/wiki/Exception_handling)) |
| sets `{1, 2}`, `set()` | not available | lists or dictionaries |
| `yield`, generators | not available; `(x for x in …)` returns a list | return a list |
| `with`, `async` / `await` | not available | `wait()` and `wait_until()` for waiting |
| `:=` (walrus), parameters after `*` | not available | a line of its own for the assignment |
| `input()` | not available | write values into the program or read them from the game |
| `math.sin`, `cos`, `log`, `exp` … | left out on purpose (not identical everywhere) | `math.sqrt`, `math.hypot`, `math.dist` |
| other modules (`time`, `os` …) | only `math` and `random` | `time()` and `wait()` from the game |
| `dir`, `id`, `hash`, `open`, `set`, `eval` … | not available | – |
| bytes `b"…"`, complex numbers `1j`, `@` | not available | – |
| `float ** float` | only `** 0.5` | `math.sqrt` |

Type annotations (`x: int = 5`) are allowed and ignored.

## Error messages {#errors}

When something goes wrong, the program stops: the line turns red and a box shows the kind of error (as in Python),
the section, the line and an explanation – often with a suggestion (“Did you mean `turn_left`?”).

| Kind | Means | Example |
|---|---|---|
| `SyntaxError` | the text cannot be read like this | `if x > 3` without colon |
| `IndentationError` | indentation does not fit | block after `:` not indented |
| `NameError` | unknown name (typo?) | `Nelia.step()`, `pirnt(1)` |
| `TypeError` | wrong type or wrong arguments | `"Wood: " + 5`, `wait("2")` |
| `ValueError` | value does not fit | `int("twelve")` |
| `IndexError` / `KeyError` | position or key missing | `[1, 2][5]`, `{}["gold"]` |
| `ZeroDivisionError` | divided by zero | `5 / 0` |
| `AttributeError` | the object does not have that | `nelia.jump()` |
| `RecursionError` | nested too deeply or computing too long | a function calls itself endlessly |
| `GameError` | the game refuses | `nelia.step()` in front of a tree, `build()` without resources |

Every entry of the reference lists the messages that can occur there under **Typical errors**.

### Hints {#hints}

Some code is valid Python and runs, but almost never does what was meant – Nelia just stands there and nobody knows
why. For this there are **hints**: they appear in amber at the line as soon as the program runs, but the program does
not stop (in a “find the mistake” task the code may be on purpose; a mission switches them off with `hints(False)`).

| Code | What happens | Hint |
|---|---|---|
| `nelia.left()` | looks left, the answer is lost – she does not turn | To turn: `nelia.turn_left()` |
| `nelia.step` | nothing: without parentheses the command does not run | Did you mean `nelia.step()`? |
| `while nelia.can_step:` | endless loop: a method without parentheses counts as true | Did you mean `can_step()`? |
| `if nelia.front() == "Tree":` | never true, the answer is `"tree"` | with the list of possible answers |
| `count == count + 1` | only compares, `count` stays the same | Did you mean `count = count + 1`? |
| `nelia.turnleft()` | does not exist (an error once the line runs) | already before the start: did you mean `turn_left`? |
| loop without action | the program computes, nothing happens in the game | after about 5 seconds |

## Worked examples {#examples}

### The five coding adventures {#ex-adventures}

Model solutions of the adventures – but try it yourself first! Every solution is played in an automated test and has
to win.

{{ex_adv1}}

{{ex_adv2}}

{{ex_adv3}}

{{ex_adv4}}

{{ex_adv5}}

### Letting serfs fell wood {#ex-lumber}

A function sends idle serfs to the nearest trees: `zip` pairs serfs and trees until one of the lists runs out.
Afterwards the program measures how much wood comes in within 30 seconds.

{{ex_lumber}}

### Walking through buildings and troops {#ex-report}

A dictionary counts the buildings per type, a loop walks through all troops, and `max(…, key=stock)` finds the
resource there is most of – functions as arguments.

{{ex_report}}

### Reacting to events: a mission {#ex-waves}

A mission script (world editor): every 60 seconds a bigger wave arrives, `wait_until` waits until it is defeated, and
the objective is completed after three waves. `@on_objective` and `@on_destroyed` decide victory and defeat.

{{ex_waves}}

### A world from code {#ex-world}

A “Build the world” section: hills from noise, a stream across the map, a grove between castle and map centre and a
goal place. In the world editor, “Bake into terrain” turns the result into the fixed map.

{{ex_world}}
