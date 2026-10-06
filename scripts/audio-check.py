#!/usr/bin/env python3
"""Audio check without speakers: renders all sounds, music and ambiences offline in
headless Chromium (scripts/audio-check.html) and checks level, clipping, length and
spectral centroid. Writes WAV files to review/ (not in Git).

Usage (dev server must be running, e.g. `npx vite --port 4290`):
    python3 scripts/audio-check.py [--url http://localhost:4290] [--no-wav]
Exit code 1 if a check fails.
"""
import argparse, base64, os, sys, wave
import numpy as np
from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEW = os.path.join(ROOT, "review")

# Expected spectral centroid (Hz) roughly per sound: (min, max). Missing entries: 150–8000.
CENTROID = {
    "cannon": (30, 600), "explosion": (30, 800), "buildingCrash": (30, 900), "thunder": (20, 400),
    "death": (60, 1500), "arrowHit": (60, 1200), "chop": (100, 1500), "hammer": (150, 1500),
    "clash": (800, 6000), "anvil": (500, 5000), "coin": (1500, 7000), "research": (600, 4000),
    "hover": (1000, 4000), "click": (500, 3000), "error": (150, 1200), "heal": (500, 5000),
    "fuse": (1500, 8000), "pickaxe": (300, 4000),
}
# Allowed energy fraction above 8 kHz (dB); beyond that it sounds hissy/unpleasant
HISS = {"fuse": -3, "coin": -8}


def decode(res):
    a = np.frombuffer(base64.b64decode(res["data"]), dtype=np.float32)
    return a.reshape(-1, res["channels"])


def write_wav(path, x, rate):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def analyse(x, rate):
    mono = x.mean(axis=1)
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    rms = float(np.sqrt(np.mean(mono ** 2))) if mono.size else 0.0
    # audible duration: range above −50 dB relative to the peak (sliding 10 ms window)
    win = max(1, rate // 100)
    env = np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode="same"))
    thr = max(peak, 1e-9) * 10 ** (-50 / 20)
    idx = np.where(env > thr)[0]
    audible = (idx[-1] - idx[0]) / rate if idx.size else 0.0
    # Power-weighted spectral centroid (insensitive to quiet noise floor)
    spec = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    freqs = np.fft.rfftfreq(len(mono), 1 / rate)
    tot = spec.sum()
    centroid = float((spec * freqs).sum() / tot) if tot > 0 else 0.0
    # Fraction above 8 kHz (hiss) in dB
    hiss = 10 * np.log10(spec[freqs >= 8000].sum() / tot + 1e-12) if tot > 0 else -99
    # DC offset (speaker-unfriendly) and end level (clicks on abrupt ending)
    dc = float(abs(mono.mean()))
    tail = float(np.max(np.abs(mono[-win:]))) if mono.size > win else 0.0
    return dict(hiss_db=float(hiss), peak_db=20 * np.log10(peak) if peak > 0 else -999, rms_db=20 * np.log10(rms) if rms > 0 else -999,
                audible=audible, centroid=centroid, dc=dc, tail_db=20 * np.log10(tail) if tail > 0 else -999)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:4290")
    ap.add_argument("--no-wav", action="store_true")
    o = ap.parse_args()
    os.makedirs(REVIEW, exist_ok=True)
    fails = []
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        page = b.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(o.url + "/scripts/audio-check.html")
        page.wait_for_function("window.ready === true", timeout=60000)
        names = page.evaluate("window.sfxNames")
        jobs = [("sfx", n, [n, 7]) for n in names]
        jobs += [("music", f"music-{t}", [t, 3, 42, False]) for t in page.evaluate("window.themeNames")]
        jobs += [("music", "music-build-lite", ["build", 1, 42, True])]
        jobs += [("jingle", f"jingle-{j}", [j]) for j in ["victory", "defeat"]]
        jobs += [("ambient", "ambient-summer", ["summer", 14, {"water": 0}]),
                 ("ambient", "ambient-rain", ["rain", 14, {}]),
                 ("ambient", "ambient-winter", ["winter", 14, {}]),
                 ("ambient", "ambient-water", ["summer", 10, {"water": 1}]),
                 ("ambient", "ambient-battle", ["summer", 10, {"battle": 1}]),
                 ("ambient", "ambient-wind", ["summer", 10, {"forest": 0, "dist": 75}])]
        for kind, label, args in jobs:
            res = page.evaluate("([k, a]) => window.renderJob(k, a)", [kind, args])
            x = decode(res)
            a = analyse(x, res["rate"])
            a.update(label=label, kind=kind, secs=res["secs"], clip=res["clip"], nan=res["nan"])
            rows.append(a)
            # Checks
            prob = []
            if res["nan"]: prob.append("NaN")
            if res["clip"] or a["peak_db"] >= -0.1: prob.append("clipping")
            if a["peak_db"] < -40: prob.append("too quiet")
            if a["dc"] > 0.01: prob.append("DC offset")
            if a["tail_db"] > -30 and kind == "sfx": prob.append("hard ending")
            if kind == "sfx":
                if a["audible"] < 0.02 or a["audible"] > 4.5: prob.append(f"duration {a['audible']:.2f}s")
                lo, hi = CENTROID.get(label, (150, 9000))
                if not lo <= a["centroid"] <= hi: prob.append(f"centroid {a['centroid']:.0f} Hz ∉ [{lo},{hi}]")
                if a["hiss_db"] > HISS.get(label, -12): prob.append(f"hiss {a['hiss_db']:.0f} dB")
            else:
                if a["rms_db"] < -45: prob.append("too quiet (RMS)")
                if kind == "music" and a["audible"] < res["secs"] * 0.6: prob.append("gaps")
                if a["hiss_db"] > -14: prob.append(f"hiss {a['hiss_db']:.0f} dB")
                if kind == "music" and not 150 <= a["centroid"] <= 2500: prob.append(f"centroid {a['centroid']:.0f} Hz")
            if prob: fails.append((label, prob))
            a["ok"] = "ok" if not prob else ", ".join(prob)
            if not o.no_wav and (kind != "sfx" or label in KEEP):
                write_wav(os.path.join(REVIEW, f"{label}.wav"), x, res["rate"])
        if not o.no_wav:
            # All effects in a row in one file for listening through
            reel = []
            for n in names:
                res = page.evaluate("([k, a]) => window.renderJob(k, a)", ["sfx", [n, 3]])
                reel.append(decode(res) * 0.7)
                reel.append(np.zeros((int(res["rate"] * 0.35), res["channels"]), dtype=np.float32))
            write_wav(os.path.join(REVIEW, "sfx-reel.wav"), np.concatenate(reel), 44100)
        b.close()
        if errors:
            fails.append(("page", errors))
    print(f"{'Sound':24} {'Length':>6} {'audible':>7} {'Peak':>7} {'RMS':>7} {'Centroid':>8} {'>8k':>5}  Result")
    for r in rows:
        print(f"{r['label']:24} {r['secs']:6.2f} {r['audible']:7.2f} {r['peak_db']:7.1f} {r['rms_db']:7.1f} {r['centroid']:8.0f} {r['hiss_db']:5.0f}  {r['ok']}")
    if fails:
        print("\nFAILURES:")
        for f in fails: print(" ", f)
        sys.exit(1)
    print(f"\nAll {len(rows)} checks passed." + ("" if o.no_wav else f" WAVs in {REVIEW}"))


KEEP = {"chop", "pickaxe", "hammer", "buildingDone", "coin", "research", "clash", "arrowShot", "cannon",
        "explosion", "heal", "click", "error", "notify", "buildingCrash"}

if __name__ == "__main__":
    main()
