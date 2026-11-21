# Writes out/molasses/shots.json (shot ranges, crossfades, flash, planned cuts + kicks) from story.ts for short_qa.py.
import json, re
src = open("src/videos/molasses/story.ts", encoding="utf-8").read()
total = int(re.search(r"TOTAL = (\d+)", src).group(1))
shots = [{"id": int(i), "a": int(a), "b": int(b) if b != "TOTAL" else total} for i, a, b in re.findall(r"\{ id: (\d+), a: (\d+), b: (\w+),", src)]
xf = {int(k): int(v) for k, v in re.findall(r"(\d+): (\d+)", re.search(r"XFADE[^=]*= \{([^}]*)\}", src).group(1))}
flash = int(re.search(r"FLASH_AT = (\d+)", src).group(1))
xfade = [[s["a"] - xf[s["id"]] // 2, s["a"] + xf[s["id"]] // 2] for s in shots if s["id"] in xf]
cuts = [[int(f), int(f)] for f in re.findall(r"\{ f: (\d+), cut: true", src)]
kicks = [[f, f + 8] for f in (726, 732, 737, 742, 748, 754, 817, 976, 2038)]
json.dump({"shots": shots, "xfade": xfade, "flash": [flash, flash + 4], "planned": cuts + kicks}, open("out/molasses/shots.json", "w"), indent=1)
print(len(shots), "shots")
