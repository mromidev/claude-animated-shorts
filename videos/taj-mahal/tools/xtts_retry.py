"""Regenerate chosen lines until the transcript has the right number of words (no hallucinated tail).
usage: python xtts_retry.py <model_dir> <ref.wav> <lines_dir> <line:text:nwords> ..."""
import sys, os
import torch, numpy as np, soundfile as sf
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from faster_whisper import WhisperModel
model_dir, ref, out, *jobs = sys.argv[1:]
torch.set_num_threads(4)
cfg = XttsConfig(); cfg.load_json(os.path.join(model_dir, "config.json"))
model = Xtts.init_from_config(cfg); model.load_checkpoint(cfg, checkpoint_dir=model_dir, eval=True)
lat, emb = model.get_conditioning_latents(audio_path=[ref])
asr = WhisperModel("medium", device="cpu", compute_type="int8")
for job in jobs:
    n, text, nw = job.split(":"); best = None
    for k, temp in enumerate([0.5, 0.4, 0.65, 0.3, 0.55, 0.45]):
        torch.manual_seed(100 + k)
        wav = np.asarray(model.inference(text, "hi", lat, emb, temperature=temp, repetition_penalty=8.0, top_p=0.8, speed=1.1)["wav"], dtype="float32")
        a16 = np.interp(np.arange(0, len(wav), 24000 / 16000), np.arange(len(wav)), wav).astype("float32")
        segs, _ = asr.transcribe(a16, language="hi", temperature=0, condition_on_previous_text=False)
        txt = " ".join(s.text.strip() for s in segs); cnt = len(txt.split())
        print(n, temp, round(len(wav) / 24000, 2), cnt, txt, flush=True)
        need = [w for w in os.environ.get("NEED", "").split(",") if w]
        ok = abs(cnt - int(nw)) <= 1 and all(any(x in txt for x in alt.split("|")) for alt in need)
        if ok: best = wav; break
    if best is not None: sf.write(os.path.join(out, f"line_{int(n):02d}.wav"), best, 24000); print("kept", n)
