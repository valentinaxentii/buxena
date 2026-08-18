"""Remove lifestyle scenery while preserving exact source-product pixels."""

from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import new_session, remove


SOURCE_DIR = Path("public/images/saunas")
OUTPUT_DIR = Path("public/images/saunas-normalized")
JOBS = {
    "aura-thermowood-1-3m-hero.jpeg": "aura-thermowood-1-3m-transparent.png",
    "nord-cube-200-hero.jpg": "nord-cube-200-transparent.png",
    "nord-cube-240-hero.jpg": "nord-cube-240-transparent.png",
    "viru-grand-6-0m-hero.jpg": "viru-grand-6-0m-transparent.png",
    "viru-panorama-5-0m-hero.jpg": "viru-panorama-5-0m-transparent.png",
    "viru-thermowood-2-4m-hero.jpg": "viru-thermowood-2-4m-transparent.png",
    "viru-thermowood-3-0m-hero.jpg": "viru-thermowood-3-0m-transparent.png",
    "viru-thermowood-3-6m-hero.jpg": "viru-thermowood-3-6m-transparent.png",
    "viru-thermowood-4-0m-hero.jpg": "viru-thermowood-4-0m-transparent.png",
    "viru-vertical-2-6m-hero.jpg": "viru-vertical-2-6m-transparent.png",
}


def square_with_padding(image: Image.Image, padding_ratio: float = 0.08) -> Image.Image:
    bbox = image.getbbox()
    if bbox is None:
        raise RuntimeError("Background remover returned an empty image")
    product = image.crop(bbox)
    longest = max(product.size)
    padding = max(20, round(longest * padding_ratio))
    side = longest + padding * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(product, ((side - product.width) // 2, (side - product.height) // 2))
    return canvas


session = new_session("isnet-general-use")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

for source_name, output_name in JOBS.items():
    source = SOURCE_DIR / source_name
    output = OUTPUT_DIR / output_name
    result = remove(
        source.read_bytes(),
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=8,
    )
    image = Image.open(BytesIO(result)).convert("RGBA")
    normalized = square_with_padding(image)
    normalized.save(output, optimize=True)
    print(f"{source_name} -> {output_name} ({normalized.width}x{normalized.height})", flush=True)
