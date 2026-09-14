"""Extract internal VIRU source pages for verification only.

These pages retain supplier catalogue branding and must never be placed in a
customer-facing public directory. Public BUXENA specification sheets are built
by ``build-viru-specification-pdfs.py``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pymupdf


MODEL_PAGES = {
    "viru-s16-1-6m": 8,
    "viru-s2-2-0m": 9,
    "viru-s23-2-3m": 9,
    "viru-thermowood-2-4m": 10,
    "viru-s28v-2-8m": 11,
    "viru-s3-3-0m": 12,
    "viru-thermowood-3-0m": 13,
    "viru-thermowood-3-6m": 14,
    "viru-s4d-4-0m": 15,
    "viru-s4pv-4-0m": 16,
    "viru-thermowood-4-0m": 17,
    "viru-sqr17-1-7m": 19,
    "viru-sqr2-2-0m": 20,
    "viru-sqr23-2-3m": 20,
    "viru-sqr2v-2-4m": 21,
    "viru-sqr3p-3-0m": 22,
    "viru-sqr3-3-0m": 23,
    "viru-sqr4pv-4-0m": 24,
    "viru-panorama-5-0m": 25,
    "viru-s242v-oval": 27,
    "viru-s242-oval": 28,
    "viru-s54-big-oval": 29,
    "viru-vertical-2-6m": 30,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("tmp/pdfs/viru-source-pages"),
    )
    args = parser.parse_args()

    if not args.source.is_file():
        raise FileNotFoundError(args.source)

    args.output.mkdir(parents=True, exist_ok=True)
    source = pymupdf.open(args.source)
    written: list[Path] = []

    for slug, page_number in MODEL_PAGES.items():
        if page_number < 1 or page_number > len(source):
            raise ValueError(f"Invalid page {page_number} for {slug}")
        target = args.output / f"{slug}-specifications.pdf"
        output = pymupdf.open()
        output.insert_pdf(source, from_page=page_number - 1, to_page=page_number - 1)
        output.set_metadata(
            {
                "title": f"{slug} specifications",
                "subject": "Model specifications, included equipment and available accessories",
            }
        )
        output.save(target, garbage=4, deflate=True)
        output.close()

        check = pymupdf.open(target)
        if len(check) != 1 or not check[0].get_text().strip():
            raise RuntimeError(f"Invalid specification sheet: {target}")
        check.close()
        written.append(target)

    print(f"Created and verified {len(written)} one-page specification PDFs")
    for path in written:
        print(path)


if __name__ == "__main__":
    main()
