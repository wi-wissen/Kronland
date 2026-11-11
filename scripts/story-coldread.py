"""Cold-read test for mission scripts (docs/kampagne/LEITFADEN.md).

Every conversation of a mission script (Markdown in the format of docs/kampagne/DREHBUCH.md: one mission per file,
steps as ## / ### headings, triggers as "- *…*" bullets, spoken lines as "> **Speaker:** text") goes on its own to
another model, which has to say where we are, what the goal is, why, and what to do next.

    python3 scripts/story-coldread.py <mission.md> <openrouter-model> <result.json>
    python3 scripts/story-coldread.py m3.md openai/gpt-6.1-sol cold-m3.json

Needs network access to openrouter.ai (in the cloud environment the proxy injects the key; curl is used directly).
"""
import re, sys, json, subprocess
path, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path, encoding='utf-8').read()
blocks = []
SKIP = ('Dramatische', 'Einleitungstext', 'Niederlage')
for part in re.split(r'\n#{2,3} ', src)[1:]:
    title = part.split('\n', 1)[0]
    if title.lstrip('0123456789. ').startswith(SKIP): continue
    trig, lines, cur = '', [], None
    def flush():
        global cur
        if cur: lines.append(cur); cur = None
    groups = []
    for l in part.split('\n'):
        t = re.match(r'^- \*([^*]+)\*', l)
        if t and t.group(1).startswith(('Dialog', 'Ziel', 'Nebenziel', 'Erklärung', 'Auslöser', 'Warum')):
            continue
        if t:
            flush()
            if lines: groups.append((trig, lines))
            trig, lines = t.group(1).rstrip(':'), []
            continue
        m = re.match(r'\s*>\s*\*\*([^*]+):\*\*\s*(.*)', l)
        if m:
            flush(); cur = f'{m.group(1)}: {m.group(2)}'
        elif cur and re.match(r'\s*>\s*\S', l):
            cur += ' ' + re.sub(r'^\s*>\s*', '', l)
        else:
            flush()
    flush()
    if lines: groups.append((trig, lines))
    for g, ls in groups:
        blocks.append((title + (' / ' + g if g else ''), ['(Was gerade im Spiel passiert ist: ' + g + ')'] + ls if g else ls))
q = '''Du bist ein Spieler, der ein Strategiespiel spielt und nur dieses Gespräch hört – ohne irgendeinen anderen Zusammenhang. Steht vor dem Gespräch in Klammern, was gerade im Spiel passiert ist, weißt du das (du hast es selbst gesehen oder getan). Ist das Gespräch nur eine kurze Reaktion auf ein Ereignis, muss es kein neues Ziel nennen; dann genügt, dass es verständlich ist. Beantworte knapp:
1. Wo sind wir? (Muss nur zu Beginn einer Mission oder bei einem Ortswechsel gesagt werden; sonst sieht der Spieler den Ort auf dem Bildschirm – dann genügt „nicht nötig“.)
2. Was ist jetzt das Ziel?
3. Warum?
4. Was soll ich als Nächstes konkret tun?
5. Gab es einen Satz, der ohne Zusammenhang kam oder unverständlich war? Welchen?
Urteil am Ende: VERSTÄNDLICH oder UNKLAR (unklar, wenn 1–4 nicht eindeutig beantwortbar sind). Ausnahme: Ist das Gespräch erkennbar das Ende der Mission oder ein Abschlusstext nach der Mission, muss kein nächster Schritt genannt sein – dann genügt, dass klar ist, was erreicht wurde und warum.

Gespräch:
'''
res = []
for title, lines in blocks:
    body = {"model": model, "messages": [{"role": "user", "content": q + '\n'.join(lines)}]}
    r = subprocess.run(['curl', '-s', 'https://openrouter.ai/api/v1/chat/completions', '-H', 'Content-Type: application/json', '-d', json.dumps(body), '--max-time', '300'], capture_output=True, text=True)
    try: ans = json.loads(r.stdout)['choices'][0]['message']['content']
    except Exception: ans = 'FEHLER: ' + r.stdout[:300]
    res.append({'step': title, 'lines': lines, 'answer': ans})
    print('==', title, '->', 'UNKLAR' if 'UNKLAR' in ans else 'VERSTÄNDLICH' if 'VERSTÄNDLICH' in ans else '?', flush=True)
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
