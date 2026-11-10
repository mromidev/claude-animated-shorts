"""Synthesize the 16 narration lines with Coqui XTTS-v2 (Hindi), cloned from one reference clip.
usage: python xtts_lines.py <xtts_model_dir> <reference.wav> <out_dir>"""
import sys, os, re, json
import torch, soundfile as sf
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts

model_dir, ref, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
script_file = os.environ.get("SCRIPT", os.path.join(os.path.dirname(__file__), "..", "SCRIPT.md"))
script = open(script_file, encoding="utf-8").read().split("```")[1]
lines = [re.sub(r"^\s*\d+\.\s*", "", l).strip() for l in script.strip().splitlines() if l.strip()]
# XTTS reads digits poorly in Hindi: the script already spells numbers; soften the dramatic pauses to commas
lines = [l.replace("...", ",").replace(" — ", ", ").replace("—", ", ") for l in lines]
assert len(lines) == int(os.environ.get("NLINES", 16)), len(lines)

torch.set_num_threads(4)
cfg = XttsConfig(); cfg.load_json(os.path.join(model_dir, "config.json"))
model = Xtts.init_from_config(cfg)
model.load_checkpoint(cfg, checkpoint_dir=model_dir, eval=True)
lat, emb = model.get_conditioning_latents(audio_path=[ref])
meta = []
for i, text in enumerate(lines):
    o = model.inference(text, "hi", lat, emb, temperature=0.6, repetition_penalty=5.0, top_p=0.85, speed=1.1, enable_text_splitting=True)
    wav = o["wav"]
    wav = wav.numpy() if hasattr(wav, "numpy") else wav
    sf.write(os.path.join(out, f"line_{i + 1:02d}.wav"), wav, 24000)
    meta.append(dict(line=i + 1, text=text, dur=round(len(wav) / 24000, 2)))
    print(i + 1, meta[-1]["dur"], text, flush=True)
json.dump(meta, open(os.path.join(out, "lines.json"), "w"), ensure_ascii=False, indent=1)
