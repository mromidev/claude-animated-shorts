"""Fill page.src.html with the narration timeline and the audio -> a self-contained page.
usage: python build_page.py timeline.json mix.mp3 out.html"""
import sys, json, base64, re
tl = json.load(open(sys.argv[1])); s = open("page.src.html", encoding="utf-8").read()
s = re.sub(r"/\*STARTS\*/.*?/\*END\*/", "/*STARTS*/" + json.dumps(tl["starts"]) + "/*END*/", s, count=1)
s = re.sub(r"/\*DUR\*/.*?/\*END\*/", "/*DUR*/" + str(tl["end"]) + "/*END*/", s, count=1)
s = s.replace("/*AUDIO*/", "data:audio/mpeg;base64," + base64.b64encode(open(sys.argv[2], "rb").read()).decode())
open(sys.argv[3], "w", encoding="utf-8").write(s); print(sys.argv[3], round(len(s) / 1e6, 2), "MB")
