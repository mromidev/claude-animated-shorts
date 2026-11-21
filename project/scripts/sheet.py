# usage: python3 scripts/sheet.py out.jpg cols img1 img2 ...  (labels each tile with its file name)
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = 270, 480
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * h), "black")
d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im.resize((w, h)), (x, y))
    d.rectangle([x, y, x + 70, y + 16], fill="black"); d.text((x + 3, y + 2), f.split("_")[-1].split(".")[0], fill="white")
S.save(out, quality=88)
