#!/usr/bin/env python3
"""ElevenLabs voice for a cartoon short: one clip per script beat, word timings from the API, one voice track.

Script lines (any text file, e.g. SCRIPT.md): `b01 First sentence of the beat.` Other lines are ignored.
Writes into OUT (default ./voice):
  <beat>.mp3 / <beat>.wav       the clip per beat (48 kHz mono wav) + <beat>.json (its word timings)
  voice.wav                     every beat on one timeline (gaps, or anchored starts), padded to whole frames
  words.json                    [{"w", "s", "e", "beat"}] in seconds on that timeline (what audio/mix.py reads)
  beats.json                    {"total_frames", "beats": [{"id", "t0", "t1"}]} (time the picture to these)

The API key is read from the ELEVENLABS_API_KEY environment variable only: never write it into a file.

Usage:
  export ELEVENLABS_API_KEY=...            (once per terminal)
  python eleven_voice.py --list-voices
  python eleven_voice.py SCRIPT.md --voice <voice_id>                       # all beats + timeline
  python eleven_voice.py SCRIPT.md --voice <voice_id> --only b03,b07        # redo some beats, rebuild timeline
  python eleven_voice.py SCRIPT.md --voice <id1>,<id2>,<id3>                # compare voices: OUT/v_<id>/ each
  python eleven_voice.py SCRIPT.md --voice <voice_id> --starts starts.json  # keep beats on fixed start times
  python eleven_voice.py SCRIPT.md --assemble-only                          # rebuild the timeline from the clips
Non-English text: keep the default model eleven_multilingual_v2.
Needs Python 3.9+ and ffmpeg/ffprobe on PATH; no pip packages.
"""
import argparse, array, base64, json, os, re, subprocess, sys, urllib.error, urllib.request, wave

API = "https://api.elevenlabs.io/v1"
SR = 48000
LINE = re.compile(r"^\s*(b\d+)\s+(.+?)\s*$")


def key():
    k = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not k:
        sys.exit("ELEVENLABS_API_KEY is not set. Run: export ELEVENLABS_API_KEY=<your key>  (do not put it in a file)")
    return k


def call(path, body=None):
    req = urllib.request.Request(API + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "application/json"},
                                 method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs HTTP {e.code} on {path}: {e.read()[:400].decode(errors='replace')}")


def read_script(path):
    beats = []
    for line in open(path, encoding="utf-8"):
        m = LINE.match(line)
        if m:
            beats.append((m.group(1), m.group(2)))
    if not beats:
        sys.exit(f"no beat lines like 'b01 Text...' found in {path}")
    return beats


def words_from_alignment(al):
    """character alignment -> words with start / end seconds (clip-relative)"""
    out, cur, s, e = [], "", None, None
    for ch, cs, ce in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if cur:
                out.append({"w": cur, "s": round(s, 3), "e": round(e, 3)})
            cur, s = "", None
            continue
        if s is None:
            s = cs
        cur += ch; e = ce
    if cur:
        out.append({"w": cur, "s": round(s, 3), "e": round(e, 3)})
    return out


def synth(beat, text, voice, out, a):
    body = {"text": text, "model_id": a.model,
            "voice_settings": {"stability": a.stability, "similarity_boost": a.similarity, "style": a.style, "use_speaker_boost": True}}
    if a.speed != 1.0:
        body["voice_settings"]["speed"] = a.speed
    r = call(f"/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128", body)
    mp3 = os.path.join(out, beat + ".mp3")
    open(mp3, "wb").write(base64.b64decode(r["audio_base64"]))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", os.path.join(out, beat + ".wav")], check=True)
    words = words_from_alignment(r.get("alignment") or r["normalized_alignment"])
    json.dump({"text": text, "voice": voice, "model": a.model, "words": words}, open(os.path.join(out, beat + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return words


def load_pcm(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        x = array.array("h"); x.frombytes(w.readframes(w.getnframes()))
    return x


def assemble(beats, out, a):
    """lay the beats on one timeline: `gap` seconds apart, or at anchored start times (--starts), trimming the clips'
    leading / trailing silence (word timings shifted to match)"""
    starts = json.load(open(a.starts)) if a.starts else {}
    pcm, words, table, t = array.array("h"), [], [], 0.0
    for i, (b, _text) in enumerate(beats):
        x = load_pcm(os.path.join(out, b + ".wav"))
        meta = json.load(open(os.path.join(out, b + ".json"), encoding="utf-8"))
        thr = 0.01 * max(1, max(abs(v) for v in x))
        lead = next((k for k, v in enumerate(x) if abs(v) > thr), 0)
        tail = len(x) - next((k for k, v in enumerate(reversed(x)) if abs(v) > thr), 0)
        lead, tail = max(0, lead - int(0.02 * SR)), min(len(x), tail + int(0.06 * SR))
        x = x[lead:tail]
        want = starts.get(b)
        gap = (a.lead if i == 0 else a.gap) if want is None else max(0.25 if i else 0.0, want - t)
        if want is not None and want < t:
            print(f"  ! {b} cannot start at {want:.3f} s: the previous beat ends at {t:.3f} s (starts {t + gap:.3f})")
        pcm.extend(array.array("h", bytes(2 * int(round(gap * SR))))); t += gap
        off = t - lead / SR
        for w in meta["words"]:
            words.append({"w": w["w"], "s": round(w["s"] + off, 3), "e": round(w["e"] + off, 3), "beat": b})
        table.append({"id": b, "t0": round(t, 3), "t1": round(t + len(x) / SR, 3)})
        pcm.extend(x); t += len(x) / SR
    pcm.extend(array.array("h", bytes(2 * int(a.tail * SR))))
    frames = max(a.min_frames, -(-len(pcm) * a.fps // SR))
    pcm.extend(array.array("h", bytes(2 * max(0, frames * SR // a.fps - len(pcm)))))
    with wave.open(os.path.join(out, "voice.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    json.dump(words, open(os.path.join(out, "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"total_frames": frames, "fps": a.fps, "beats": table}, open(os.path.join(out, "beats.json"), "w"), indent=1)
    for r in table:
        print(f"  {r['id']}  {r['t0']:7.3f} - {r['t1']:7.3f} s   frames {round(r['t0'] * a.fps):5d} - {round(r['t1'] * a.fps):5d}")
    print(f"  voice.wav {frames} frames ({frames / a.fps:.2f} s), {len(words)} words -> {out}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("script", nargs="?")
    p.add_argument("--voice", help="voice id, or several comma-separated ids to compare (each goes to OUT/v_<id>)")
    p.add_argument("--out", default="voice")
    p.add_argument("--only", help="comma-separated beats to (re)generate, e.g. b03,b07")
    p.add_argument("--model", default="eleven_multilingual_v2")
    p.add_argument("--stability", type=float, default=0.55)
    p.add_argument("--similarity", type=float, default=0.8)
    p.add_argument("--style", type=float, default=0.15)
    p.add_argument("--speed", type=float, default=1.0, help="0.7-1.2; leave 1.0 unless a beat must fit a window")
    p.add_argument("--gap", type=float, default=0.45, help="seconds between beats")
    p.add_argument("--lead", type=float, default=0.45, help="silence before the first beat")
    p.add_argument("--tail", type=float, default=3.0, help="silence after the last beat (end card)")
    p.add_argument("--starts", help='JSON {"b02": 6.55, ...}: keep these beats on fixed start times (picture already timed)')
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--min-frames", type=int, default=0, help="pad voice.wav to at least this many frames (= the composition)")
    p.add_argument("--assemble-only", action="store_true")
    p.add_argument("--list-voices", action="store_true")
    a = p.parse_args()
    if a.list_voices:
        for v in call("/voices")["voices"]:
            lab = v.get("labels") or {}
            print(f"{v['voice_id']}  {v['name']:<28} {lab.get('gender', ''):<7} {lab.get('accent', ''):<12} {lab.get('description', '')}")
        return
    if not a.script:
        p.error("SCRIPT is required")
    beats = read_script(a.script)
    voices = [v.strip() for v in (a.voice or "").split(",") if v.strip()]
    if not voices and not a.assemble_only:
        p.error("--voice is required (see --list-voices)")
    only = {b.strip() for b in a.only.split(",")} if a.only else None
    for voice in voices or [None]:
        out = os.path.join(a.out, "v_" + voice) if len(voices) > 1 else a.out
        os.makedirs(out, exist_ok=True)
        print(f"== {voice or 'assemble'} -> {out}")
        if not a.assemble_only:
            for b, text in beats:
                if only and b not in only:
                    continue
                w = synth(b, text, voice, out, a)
                print(f"  {b} {w[-1]['e'] if w else 0:5.2f} s  {text}")
        missing = [b for b, _ in beats if not os.path.exists(os.path.join(out, b + ".wav"))]
        if missing:
            sys.exit(f"missing clips {missing}: generate them first (drop --only / --assemble-only)")
        assemble(beats, out, a)


if __name__ == "__main__":
    main()
