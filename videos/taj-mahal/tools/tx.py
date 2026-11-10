import sys, json
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[2], device="cpu", compute_type="int8")
import soundfile as sf; a,_=sf.read(sys.argv[1],dtype="float32"); segs, _ = m.transcribe(a, language="hi", word_timestamps=True, vad_filter=False, beam_size=5)
out = []
for s in segs:
    print(f"{s.start:6.2f}-{s.end:6.2f} {s.text}", flush=True)
    out += [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 2)) for w in s.words]
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False, indent=0)
