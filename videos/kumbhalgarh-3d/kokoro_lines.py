"""Narration with Kokoro-82M (Apache-2.0), voice bm_george. spaCy does not build on this Python, so phonemes come
from espeak-ng (misaki.espeak) and the model is called directly.
usage: python kokoro_lines.py NARRATION.md out_dir [voice] [speed]"""
import sys, types, os, re, json
sys.modules["spacy"] = types.ModuleType("spacy")
import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper
EspeakWrapper.set_library(espeakng_loader.get_library_path()); EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
import numpy as np, soundfile as sf, torch
from kokoro import KModel
from misaki import espeak
from huggingface_hub import hf_hub_download
src, out = sys.argv[1:3]; voice = sys.argv[3] if len(sys.argv) > 3 else "bm_george"; speed = float(sys.argv[4]) if len(sys.argv) > 4 else 0.92
os.makedirs(out, exist_ok=True)
lines = [re.sub(r"^\s*\d+\.\s*", "", l).strip() for l in open(src, encoding="utf-8").read().split("```")[1].strip().splitlines() if l.strip()]
model = KModel().eval(); g2p = espeak.EspeakG2P(language="en-gb")
pack = torch.load(hf_hub_download("hexgrad/Kokoro-82M", f"voices/{voice}.pt"), weights_only=True)
meta = []
for i, text in enumerate(lines):
    parts = []
    say = text
    for k, v in {"Mewar": "Maywaar", "Badal Mahal": "Baadul Mahal"}.items(): say = say.replace(k, v)   # spoken spellings
    for sent in re.split(r"(?<=[.!?])\s+", say):            # one sentence at a time, short pause between
        ps = g2p(sent); ps = ps if isinstance(ps, str) else ps[0]
        with torch.no_grad(): parts += [model(ps, pack[len(ps) - 1], speed).numpy(), np.zeros(int(0.28 * 24000), dtype="float32")]
    a = np.concatenate(parts[:-1])
    sf.write(os.path.join(out, f"line_{i + 1:02d}.wav"), a, 24000)
    meta.append(dict(line=i + 1, text=text, dur=round(len(a) / 24000, 2))); print(i + 1, meta[-1]["dur"], flush=True)
json.dump(meta, open(os.path.join(out, "lines.json"), "w"), indent=1)
