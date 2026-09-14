"""Extract the exact supplier photographs from the Baltresto sauna catalogue.

The catalogue stores each product photograph on the left page of a two-page
spread. This script renders only the required spreads and makes a consistent
square crop for the public catalogue cards while preserving the original PDF.
"""

from pathlib import Path

import pypdfium2 as pdfium


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = Path(r"C:\Users\valen\Downloads\baltresto-saunas-online-eng (1).pdf")
OUTPUT_DIR = PROJECT_ROOT / "public" / "images" / "saunas-normalized"

# PDF page number -> output filename. S2/S23 and SQR2/SQR23 share the exact
# supplier photograph because Baltresto publishes those sizes on one spread.
PHOTO_PAGES = {
    8: "viru-s16-1-6m-baltresto.jpg",
    9: "viru-s2-s23-baltresto.jpg",
    11: "viru-s28v-2-8m-baltresto.jpg",
    12: "viru-s3-3-0m-baltresto.jpg",
    15: "viru-s4d-4-0m-baltresto.jpg",
    16: "viru-s4pv-4-0m-baltresto.jpg",
    19: "viru-sqr17-1-7m-baltresto.jpg",
    20: "viru-sqr2-sqr23-baltresto.jpg",
    21: "viru-sqr2v-2-4m-baltresto.jpg",
    22: "viru-sqr3p-3-0m-baltresto.jpg",
    23: "viru-sqr3-3-0m-baltresto.jpg",
    24: "viru-sqr4pv-4-0m-baltresto.jpg",
    27: "viru-s242v-oval-baltresto.jpg",
    28: "viru-s242-oval-baltresto.jpg",
    29: "viru-s54-big-oval-baltresto.jpg",
}


def extract_photo(page, output_path: Path) -> None:
    rendered = page.render(scale=2.5).to_pil().convert("RGB")
    spread_width, spread_height = rendered.size
    photo_width = spread_width // 2

    # Use a consistent square crop from the photographic half. The starting
    # point removes the printed website/page header but retains the entire
    # sauna product in Baltresto's standard catalogue composition.
    crop_top = int(spread_height * 0.20)
    crop_bottom = min(crop_top + photo_width, spread_height)
    crop_top = max(0, crop_bottom - photo_width)
    photo = rendered.crop((0, crop_top, photo_width, crop_bottom))
    photo.save(output_path, "JPEG", quality=92, optimize=True, progressive=True)


def main() -> None:
    if not SOURCE_PDF.exists():
        raise FileNotFoundError(f"Supplier catalogue not found: {SOURCE_PDF}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf = pdfium.PdfDocument(str(SOURCE_PDF))

    for page_number, filename in PHOTO_PAGES.items():
        output_path = OUTPUT_DIR / filename
        extract_photo(pdf[page_number - 1], output_path)
        print(f"Extracted page {page_number}: {output_path.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
