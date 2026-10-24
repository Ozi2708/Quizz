"""Bande son de démonstration, synthétisée : petite boucle légère (marimba, basse douce, shaker)
et bruitages discrets calés sur les événements de l'animation.
Provisoire : à remplacer par une musique signature (Suno Pro ou bibliothèque sous licence)."""
import json, sys, wave
import numpy as np

SR = 44100
data = json.load(open(sys.argv[1]))
n = int(data["duration"] * SR) + SR
music = np.zeros(n)
sfx = np.zeros(n)
rng = np.random.default_rng(7)


def add(buf, sound, at, gain=1.0):
    i = int(at * SR)
    j = min(n, i + len(sound))
    if 0 <= i < n:
        buf[i:j] += gain * sound[: j - i]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def mallet(f, dur=.9, bright=.35):
    t = tt(dur)
    attack = np.minimum(1, t / .004)
    return attack * (np.sin(2 * np.pi * f * t) * np.exp(-t * 4.5) + bright * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 18))


def soft_noise(dur, decay, smooth):
    t = tt(dur)
    x = np.convolve(rng.standard_normal(len(t)), np.ones(smooth) / smooth, "same")
    return x * np.exp(-t * decay)


def mx(*parts):
    out = np.zeros(max(len(p) for p in parts))
    for p in parts:
        out[: len(p)] += p
    return out


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


# --- Boucle : 100 BPM, Fa majeur, F - Dm - Bb - C, une mesure par accord
beat = 60 / 100
chords = [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]]
pattern = [0, 1, 2, 1, 0, 2, 1, 2]  # croches
bar = 0
t0 = 0.0
while t0 < data["duration"]:
    ch = chords[bar % 4]
    for k, idx in enumerate(pattern):
        note = ch[idx] + (12 if k in (2, 5) else 0)
        add(music, mallet(hz(note), .7, .25), t0 + k * beat / 2, .16 if k % 2 == 0 else .11)
    # basse ronde sur les temps 1 et 3
    for b in (0, 2):
        t = tt(beat * 1.8)
        add(music, np.sin(2 * np.pi * hz(ch[0] - 24) * t) * np.minimum(1, t / .01) * np.exp(-t * 2.2), t0 + b * beat, .22)
    # shaker très léger en doubles croches
    for k in range(16):
        add(music, soft_noise(.035, 120, 2), t0 + k * beat / 4, .035 if k % 2 else .06)
    t0 += 4 * beat
    bar += 1


def arp(notes, step=.07, gain=1):
    out = np.zeros(int((len(notes) * step + 1.2) * SR))
    for k, m in enumerate(notes):
        s = mallet(hz(m), 1.1, .3) * gain
        i = int(k * step * SR)
        out[i:i + len(s)] += s
    return out


SFX = {
    "slam": lambda: mallet(hz(41), .5, .1) * .5 + 0,              # « toc » grave et doux
    "pop": lambda: mallet(hz(84), .12, .05) * .18,                 # petite goutte
    "tick-soft": lambda: np.zeros(10),
    "tick": lambda: np.zeros(10),
    "tick-hot": lambda: mallet(hz(93), .08, .0) * .22,             # tic de bois, seulement les 3 dernières secondes
    "buzz": lambda: arp([77, 81, 84, 89], .06, .5),                # bonne réponse : arpège clair
    "scribble": lambda: soft_noise(.35, 6, 14) * .18,              # trait de feutre
    "stamp": lambda: mx(mallet(hz(38), .35, .05) * .6, soft_noise(.08, 40, 6) * .35),   # tampon posé
    "whoosh": lambda: soft_noise(.45, 0, 30) * np.sin(np.pi * tt(.45) / .45) * .5,
    "draw": lambda: soft_noise(.6, 3, 10) * .08,                   # crayon qui dessine
    "sparkle": lambda: arp([96, 100, 103], .04, .12),
}
for ev in data["events"]:
    add(sfx, SFX[ev["type"]](), ev["at"])

music /= max(1e-9, np.abs(music).max())
sfx /= max(1e-9, np.abs(sfx).max())
mix = music * .38 + sfx * .7
mix[: int(.3 * SR)] *= np.linspace(0, 1, int(.3 * SR))
mix[-int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR))
mix = np.tanh(mix * 1.1) * .8
# léger élargissement stéréo : la boucle un peu décalée à droite
left = mix
right = np.concatenate([np.zeros(240), mix[:-240]]) * .5 + mix * .5
pcm = (np.stack([left, right], axis=1) * 32767).astype(np.int16)
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
