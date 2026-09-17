#!/usr/bin/env python3
"""Build web-ready sprites in public/assets from the source art in assets/."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = ROOT / "public" / "assets"
# dragon-fly-down.png carries a stray "and the" caption in rows 0-2; the body starts at row 69.
FLY_DOWN_CAPTION_ROWS = 20


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC.glob("*.png")):
        img = Image.open(src).convert("RGBA")
        name = src.stem
        if name == "dragon-fly-down":
            img.paste((0, 0, 0, 0), (0, 0, img.width, FLY_DOWN_CAPTION_ROWS))
        if name.startswith("rock-"):
            bbox = img.getchannel("A").getbbox()
            if bbox:
                img = img.crop(bbox)
        if name == "background":
            dest = OUT / "background.webp"
            img.save(dest, "WEBP", quality=90, method=6)
        else:
            dest = OUT / f"{name}.png"
            img.save(dest, "PNG", optimize=True)
        print(f"{dest.relative_to(ROOT)}  {img.width}x{img.height}  {dest.stat().st_size // 1024} KB")

    fly_down = Image.open(OUT / "dragon-fly-down.png").getchannel("A").getbbox()
    assert fly_down is not None and fly_down[1] >= 60, f"caption not removed: bbox={fly_down}"


if __name__ == "__main__":
    main()
