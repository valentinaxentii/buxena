"""Create labelled contact sheets from rendered PDF pages for visual QA."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--per-sheet", type=int, default=12)
    parser.add_argument("--thumb-width", type=int, default=420)
    args = parser.parse_args()

    files = sorted(args.input.glob("*.png"))
    if not files:
        raise RuntimeError(f"No PNG pages found in {args.input}")

    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=15)
    label_height = 34
    gap = 16

    for sheet_index, start in enumerate(range(0, len(files), args.per_sheet), start=1):
        chunk = files[start : start + args.per_sheet]
        thumbs: list[tuple[Path, Image.Image]] = []
        cell_height = 0
        for path in chunk:
            with Image.open(path) as source:
                thumb_height = round(source.height * args.thumb_width / source.width)
                thumb = source.convert("RGB").resize((args.thumb_width, thumb_height), Image.Resampling.LANCZOS)
            thumbs.append((path, thumb))
            cell_height = max(cell_height, thumb.height + label_height)

        rows = math.ceil(len(thumbs) / args.columns)
        width = args.columns * args.thumb_width + (args.columns + 1) * gap
        height = rows * cell_height + (rows + 1) * gap
        sheet = Image.new("RGB", (width, height), "#ddd8cf")
        draw = ImageDraw.Draw(sheet)

        for index, (path, thumb) in enumerate(thumbs):
            row, column = divmod(index, args.columns)
            x = gap + column * (args.thumb_width + gap)
            y = gap + row * (cell_height + gap)
            sheet.paste(thumb, (x, y))
            draw.rectangle((x, y + thumb.height, x + args.thumb_width, y + cell_height), fill="#1b1917")
            draw.text((x + 8, y + thumb.height + 8), path.stem, fill="#f6f2ea", font=font)

        target = args.output / f"contact-sheet-{sheet_index:02d}.jpg"
        sheet.save(target, quality=90, optimize=True)
        print(target)


if __name__ == "__main__":
    main()
