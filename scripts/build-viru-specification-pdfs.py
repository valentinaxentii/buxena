"""Build customer-facing BUXENA VIRU specification PDFs.

The local model pages are the rendered source of truth: they already combine
the verified product frontmatter with the exact catalogue mapping. This script
reads that public information and rebuilds it as consistent, supplier-neutral
BUXENA documents. Raw catalogue pages are deliberately never copied into the
public downloads directory.
"""

from __future__ import annotations

import argparse
import html as html_module
import os
import re
import tempfile
from PIL import Image as PILImage
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

from lxml import html
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageTemplate,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "docs" / "specifications"
LOGO = ROOT / "public" / "brand" / "buxena-logo-transparent.png"

MODEL_SLUGS = (
    "viru-s16-1-6m",
    "viru-s2-2-0m",
    "viru-s23-2-3m",
    "viru-thermowood-2-4m",
    "viru-s28v-2-8m",
    "viru-s3-3-0m",
    "viru-thermowood-3-0m",
    "viru-thermowood-3-6m",
    "viru-s4d-4-0m",
    "viru-s4pv-4-0m",
    "viru-thermowood-4-0m",
    "viru-sqr17-1-7m",
    "viru-sqr2-2-0m",
    "viru-sqr23-2-3m",
    "viru-sqr2v-2-4m",
    "viru-sqr3p-3-0m",
    "viru-sqr3-3-0m",
    "viru-sqr4pv-4-0m",
    "viru-panorama-5-0m",
    "viru-s242v-oval",
    "viru-s242-oval",
    "viru-s54-big-oval",
    "viru-vertical-2-6m",
)

DRAWING_DIR = ROOT / "tmp" / "catalogue-drawings" / "crops"

LINEN = colors.HexColor("#F6F2EA")
LINEN_DEEP = colors.HexColor("#F0EBE1")
EMBER = colors.HexColor("#1B1917")
INK = colors.HexColor("#241F1A")
MUTED = colors.HexColor("#4D4238")
BRONZE = colors.HexColor("#9C7A4A")
BRONZE_INK = colors.HexColor("#6E532F")
LINE = colors.HexColor("#CBBFA9")
WHITE = colors.white


@dataclass(frozen=True)
class TechnicalRow:
    label: str
    metric: str
    imperial: str
    combined: bool = False


@dataclass(frozen=True)
class ModelData:
    slug: str
    title: str
    subtitle: str
    technical: tuple[TechnicalRow, ...]
    heating: tuple[tuple[str, str, str], ...]
    basic_set: tuple[str, ...]
    choices: tuple[tuple[str, str], ...]
    accessories: tuple[tuple[str, tuple[str, ...]], ...]
    drawing_path: Path | None = None


def normalize(value: str) -> str:
    """Keep customer text clean and compatible with embedded PDF fonts."""
    value = html_module.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    replacements = {
        "\u00a0": " ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u00d7": "x",
        "\u00b2": "2",
        "\u00b3": "3",
        "\u2032": " ft",
        "\u2033": " in",
        "\u2713": "Compatible",
        "\u2715": "Not compatible",
        "\u2011": "-",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    value = re.sub(r"\bApprox\.\s+Approx\.\s*", "Approx. ", value, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", value).strip()


def node_text(node) -> str:
    return normalize(" ".join(node.itertext()))


def class_nodes(root, class_name: str):
    return root.xpath(
        "//*[contains(concat(' ', normalize-space(@class), ' '), $class_name)]",
        class_name=f" {class_name} ",
    )


def first_class(root, class_name: str):
    nodes = class_nodes(root, class_name)
    if not nodes:
        raise RuntimeError(f"Missing .{class_name}")
    return nodes[0]


def fetch_model(base_url: str, slug: str) -> ModelData:
    url = f"{base_url.rstrip('/')}/saunas/{slug}/"
    request = Request(url, headers={"User-Agent": "BUXENA-specification-builder/1.0"})
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned HTTP {response.status}")
        root = html.fromstring(response.read())

    title = node_text(first_class(root, "techsheet__title"))
    subtitle_nodes = class_nodes(root, "techsheet__subtitle")
    subtitle = node_text(subtitle_nodes[0]) if subtitle_nodes else "Verified model specifications"

    technical_table = first_class(root, "techsheet__table")
    technical: list[TechnicalRow] = []
    for tr in technical_table.xpath(".//tbody/tr"):
        cells = tr.xpath("./th|./td")
        values = [node_text(cell) for cell in cells]
        if len(values) < 2:
            continue
        label = "Model reference" if values[0].lower() == "supplier model" else values[0]
        if len(values) == 2:
            technical.append(TechnicalRow(label, values[1], "", True))
        else:
            technical.append(TechnicalRow(label, values[1], values[2], False))

    heating: list[tuple[str, str, str]] = []
    heating_tables = class_nodes(root, "techsheet__compattable")
    if heating_tables:
        for tr in heating_tables[0].xpath(".//tr"):
            values = [node_text(cell) for cell in tr.xpath("./th|./td")]
            if len(values) >= 2:
                state = "Not compatible" if "not compatible" in values[1].lower() else "Compatible"
                heating.append((values[0], state, values[2] if len(values) > 2 else ""))

    basic_block = first_class(root, "catalogue-details__included")
    basic_set = tuple(node_text(li) for li in basic_block.xpath(".//li") if node_text(li))

    choices_block = first_class(root, "catalogue-details__choices")
    choices: list[tuple[str, str]] = []
    for group in choices_block.xpath("./div"):
        dt = group.xpath("./dt")
        dd = group.xpath("./dd")
        if dt and dd:
            choices.append((node_text(dt[0]), node_text(dd[0])))

    accessories_block = first_class(root, "catalogue-details__grid")
    accessories: list[tuple[str, tuple[str, ...]]] = []
    for section in accessories_block.xpath("./section"):
        heading = section.xpath("./h5")
        if not heading:
            continue
        items = tuple(node_text(li) for li in section.xpath(".//li") if node_text(li))
        accessories.append((node_text(heading[0]), items))

    all_text = " ".join(
        [title, subtitle]
        + [f"{row.label} {row.metric} {row.imperial}" for row in technical]
        + [" ".join(row) for row in heating]
        + list(basic_set)
        + [" ".join(row) for row in choices]
        + [f"{label} {' '.join(items)}" for label, items in accessories]
    )
    if "baltresto" in all_text.lower():
        raise RuntimeError(f"Supplier branding found in rendered source for {slug}")
    if not technical or not basic_set or not accessories:
        raise RuntimeError(f"Incomplete rendered specification content for {slug}")

    return ModelData(
        slug=slug,
        title=title,
        subtitle=subtitle,
        technical=tuple(technical),
        heating=tuple(heating),
        basic_set=basic_set,
        choices=tuple(choices),
        accessories=tuple(accessories),
        drawing_path=DRAWING_DIR / f"{slug}.png",
    )


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(normalize(text)), style)


def bullet_rows(items: Iterable[str], styles: dict[str, ParagraphStyle]) -> list[list[Flowable]]:
    return [
        [
            Paragraph('<font color="#9C7A4A">-</font>', styles["bullet_mark"]),
            p(item, styles["body"]),
        ]
        for item in items
    ]


def bullets(items: Iterable[str], styles: dict[str, ParagraphStyle]) -> Table:
    rows = bullet_rows(items, styles)
    table = Table(rows, colWidths=[0.16 * inch, 6.66 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    return table


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "BuxenaTitle",
            parent=sample["Title"],
            fontName="Times-Roman",
            fontSize=27,
            leading=30,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "BuxenaSubtitle",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=MUTED,
            spaceAfter=12,
        ),
        "eyebrow": ParagraphStyle(
            "BuxenaEyebrow",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=BRONZE_INK,
            tracking=1.6,
            spaceBefore=5,
            spaceAfter=4,
        ),
        "section": ParagraphStyle(
            "BuxenaSection",
            parent=sample["Heading2"],
            fontName="Times-Roman",
            fontSize=15,
            leading=18,
            textColor=INK,
            spaceBefore=5,
            spaceAfter=7,
        ),
        "subsection": ParagraphStyle(
            "BuxenaSubsection",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=BRONZE_INK,
            tracking=1.1,
            spaceBefore=5,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "BuxenaBody",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.3,
            leading=11.5,
            textColor=INK,
        ),
        "body_bold": ParagraphStyle(
            "BuxenaBodyBold",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.3,
            leading=11.5,
            textColor=INK,
        ),
        "table": ParagraphStyle(
            "BuxenaTable",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=7.4,
            leading=9.5,
            textColor=INK,
        ),
        "table_bold": ParagraphStyle(
            "BuxenaTableBold",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=9.5,
            textColor=INK,
        ),
        "table_head": ParagraphStyle(
            "BuxenaTableHead",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.8,
            leading=8.5,
            textColor=WHITE,
            tracking=0.6,
        ),
        "note": ParagraphStyle(
            "BuxenaNote",
            parent=sample["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=7.4,
            leading=10.5,
            textColor=MUTED,
            spaceBefore=7,
        ),
        "bullet_mark": ParagraphStyle(
            "BuxenaBulletMark",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=TA_LEFT,
        ),
        "right_label": ParagraphStyle(
            "BuxenaRightLabel",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=BRONZE_INK,
            alignment=TA_RIGHT,
            tracking=1.2,
        ),
    }


def draw_page(canvas, doc) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(LINEN)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.55)
    canvas.line(doc.leftMargin, 0.48 * inch, width - doc.rightMargin, 0.48 * inch)
    canvas.setFont("Helvetica", 6.7)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.29 * inch, "BUXENA  |  buxena.com  |  info@buxena.com")
    canvas.drawRightString(width - doc.rightMargin, 0.29 * inch, f"PAGE {doc.page}")
    canvas.restoreState()


class BuxenaDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="BUXENA", frames=[frame], onPage=draw_page))


def logo_flowable(styles: dict[str, ParagraphStyle]) -> Table:
    with PILImage.open(LOGO) as image:
        width, height = image.size
    logo_width = 1.48 * inch
    logo_height = logo_width * height / width
    logo = Image(str(LOGO), width=logo_width, height=logo_height, mask="auto")
    label = Paragraph("MODEL SPECIFICATION", styles["right_label"])
    table = Table([[logo, label]], colWidths=[3.6 * inch, 3.2 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.7, BRONZE),
            ]
        )
    )
    return table


def section_heading(eyebrow: str, title: str, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    return [
        Paragraph(escape(eyebrow.upper()), styles["eyebrow"]),
        p(title, styles["section"]),
    ]


def technical_table(model: ModelData, styles: dict[str, ParagraphStyle], compact: bool = False) -> Table:
    data: list[list[Flowable]] = [
        [
            Paragraph("TECHNICAL INFORMATION", styles["table_head"]),
            Paragraph("METRIC", styles["table_head"]),
            Paragraph("IMPERIAL", styles["table_head"]),
        ]
    ]
    spans: list[tuple] = []
    for row_index, row in enumerate(model.technical, start=1):
        data.append(
            [
                p(row.label, styles["table_bold"]),
                p(row.metric or "-", styles["table"]),
                p(row.imperial or "-", styles["table"]),
            ]
        )
        if row.combined:
            spans.append(("SPAN", (1, row_index), (2, row_index)))

    widths = [1.45 * inch, 1.50 * inch, 1.47 * inch] if compact else [2.25 * inch, 2.28 * inch, 2.27 * inch]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), EMBER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LINEN, LINEN_DEEP]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                *spans,
            ]
        )
    )
    return table


def heating_table(model: ModelData, styles: dict[str, ParagraphStyle]) -> Table:
    rows: list[list[Flowable]] = []
    for label, state, note in model.heating:
        state_style = ParagraphStyle(
            f"state-{state}",
            parent=styles["table_bold"],
            textColor=BRONZE_INK if state == "Compatible" else MUTED,
        )
        rows.append([p(label, styles["table_bold"]), p(state, state_style), p(note or "-", styles["table"])])
    table = Table(rows, colWidths=[2.25 * inch, 1.45 * inch, 3.1 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), LINEN_DEEP),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def choices_table(model: ModelData, styles: dict[str, ParagraphStyle]) -> Table:
    rows = [[p(label, styles["table_bold"]), p(value, styles["table"])] for label, value in model.choices]
    table = Table(rows, colWidths=[1.42 * inch, 5.38 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.35, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("BACKGROUND", (0, 0), (0, -1), LINEN_DEEP),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def accessory_block(label: str, items: tuple[str, ...], styles: dict[str, ParagraphStyle]) -> KeepTogether:
    return KeepTogether(
        [
            Paragraph(escape(label.upper()), styles["subsection"]),
            bullets(items, styles),
        ]
    )


def build_pdf(model: ModelData, target: Path, drawing_page_two: bool = False) -> None:
    styles = build_styles()
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="buxena-spec-") as temp_dir:
        temporary = Path(temp_dir) / target.name
        doc = BuxenaDocTemplate(
            str(temporary),
            pagesize=letter,
            leftMargin=0.72 * inch,
            rightMargin=0.72 * inch,
            topMargin=0.52 * inch,
            bottomMargin=0.65 * inch,
            title=f"BUXENA {model.title} Specifications",
            author="BUXENA",
            subject="Model specifications, included equipment and available options",
            creator="BUXENA",
        )

        technical_content: Flowable = technical_table(model, styles, compact=bool(drawing_page_two or (model.drawing_path and model.drawing_path.exists())))
        if model.drawing_path and model.drawing_path.exists() and not drawing_page_two:
            drawing = Image(str(model.drawing_path), width=2.18 * inch, height=4.25 * inch, kind="proportional", mask="auto")
            drawing_panel = Table(
                [[Paragraph("DIMENSION DRAWING", styles["table_head"])], [drawing]],
                colWidths=[2.25 * inch],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), EMBER),
                    ("BOX", (0, 0), (-1, -1), 0.35, LINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]),
            )
            technical_content = Table(
                [[technical_content, drawing_panel]],
                colWidths=[4.42 * inch, 2.30 * inch],
                style=TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]),
            )

        # The customer-facing format is intentionally consistent across every model:
        # technical data on page one, then drawings, included equipment and upgrades
        # in the same structured layout on page two.
        compact = styles["body"].__class__("compact", parent=styles["body"], fontSize=7.0, leading=8.2, spaceAfter=1)
        compact_head = styles["subsection"].__class__("compact-head", parent=styles["subsection"], fontSize=7.2, leading=8.4, spaceBefore=3, spaceAfter=2)
        compact_title = styles["section"].__class__("compact-title", parent=styles["section"], fontSize=13.5, leading=14.5, spaceBefore=0, spaceAfter=0)
        def compact_p(text: str, style: ParagraphStyle = compact) -> Paragraph:
            return Paragraph(escape(normalize(text)), style)
        def compact_bullets(items: tuple[str, ...]) -> list[Paragraph]:
            return [compact_p(f"-   {item}") for item in items]
        def choices_text() -> Paragraph:
            return Paragraph("  |  ".join(f"{escape(normalize(label))}: {escape(normalize(value))}" for label, value in model.choices), compact)

        story: list[Flowable] = [
            logo_flowable(styles),
            Spacer(1, 0.14 * inch),
            p(model.title, styles["title"]),
            p(model.subtitle, styles["subtitle"]),
            *section_heading("Verified model data", "Technical information", styles),
            technical_content,
        ]

        if model.heating:
            story.extend(
                [
                    Spacer(1, 0.08 * inch),
                    Paragraph("COMPATIBLE HEATING", styles["subsection"]),
                    heating_table(model, styles),
                ]
            )

        if model.drawing_path and model.drawing_path.exists():
            source_image = PILImage.open(model.drawing_path).convert("RGBA")
            split_y = int(source_image.height * 0.56)
            front_path = Path(temp_dir) / f"{model.slug}-front.png"
            side_path = Path(temp_dir) / f"{model.slug}-side.png"
            source_image.crop((0, 0, source_image.width, split_y)).save(front_path)
            source_image.crop((0, int(source_image.height * 0.52), source_image.width, source_image.height)).save(side_path)
            front = Image(str(front_path), width=2.88 * inch, height=2.35 * inch, kind="proportional", mask="auto")
            side = Image(str(side_path), width=2.98 * inch, height=2.25 * inch, kind="proportional", mask="auto")
            label_style = styles["subsection"].__class__("drawing-label", parent=styles["subsection"], fontSize=7.0, leading=8.0, alignment=1, spaceAfter=2)
            def drawing_card(label: str, image: Image) -> Table:
                return Table(
                    [[Paragraph(label, label_style)], [image]],
                    colWidths=[3.12 * inch],
                    rowHeights=[0.22 * inch, 2.40 * inch],
                    style=TableStyle([
                        ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                        ("BACKGROUND", (0, 0), (-1, 0), LINEN_DEEP),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 3),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]),
                )
            drawing_card = Table(
                [[drawing_card("FRONT ELEVATION", front), drawing_card("SIDE ELEVATION", side)]],
                colWidths=[3.3 * inch, 3.3 * inch],
                style=TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]),
            )
            basic_text = [Spacer(1, 0.10 * inch), Paragraph("BASIC SET INCLUDES", compact_head), *compact_bullets(model.basic_set)]
            config_text = [Spacer(1, 0.10 * inch), choices_text()]
            content_heading = Table(
                [[compact_p("Complete model information", compact_title), compact_p("CONFIGURATION CHOICES", compact_title)]],
                colWidths=[3.3 * inch, 3.3 * inch],
                style=TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]),
            )
            content = Table(
                [[basic_text, config_text]],
                colWidths=[3.3 * inch, 3.3 * inch],
                style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]),
            )
            accessory_columns = {label.lower(): [Paragraph(escape(label.upper()), compact_head), *compact_bullets(items)] for label, items in model.accessories}
            accessory_grid = Table(
                [[accessory_columns.get("front wall", []), accessory_columns.get("back wall", []), accessory_columns.get("interior", []), accessory_columns.get("exterior", [])]],
                colWidths=[1.62 * inch] * 4,
                style=TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBEFORE", (1, 0), (-1, -1), 0.35, LINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                ]),
            )
            page2_heading = [Paragraph("VERIFIED MODEL DRAWING", compact_head), compact_p("Dimensions and complete model information", compact_title)]
            upgrade_heading = [Paragraph("AVAILABLE UPGRADES", compact_head), compact_p("Additional equipment and accessories", compact_title)]
            story.extend([PageBreak(), *page2_heading, Spacer(1, 0.10 * inch), drawing_card, Spacer(1, 0.10 * inch), content_heading, content, Spacer(1, 0.25 * inch), *upgrade_heading, Spacer(1, 0.04 * inch), accessory_grid])
        else:
            story.extend([Spacer(1, 0.08 * inch), *section_heading("Included and configurable", "Complete model information", styles), Paragraph("BASIC SET INCLUDES", styles["subsection"]), bullets(model.basic_set, styles), Spacer(1, 0.05 * inch), Paragraph("CONFIGURATION CHOICES", styles["subsection"]), choices_table(model, styles), Spacer(1, 0.08 * inch), *section_heading("Available upgrades", "Additional equipment and accessories", styles)])
            for label, items in model.accessories:
                story.append(accessory_block(label, items, styles))

        story.extend(
            [
                Spacer(1, 0.08 * inch),
                Paragraph(
                    "Specifications reflect verified model information. Imperial values marked Approx. are calculated from metric measurements. Final heater, electrical, site, delivery and configuration requirements are confirmed in your written BUXENA quote.",
                    styles["note"],
                ),
            ]
        )

        doc.build(story)

        reader = PdfReader(str(temporary))
        extracted = " ".join((page.extract_text() or "") for page in reader.pages)
        lowered = extracted.lower()
        required = ("buxena", model.title.lower(), "technical information", "basic set includes")
        missing = [term for term in required if term not in lowered]
        if missing:
            raise RuntimeError(f"{model.slug}: generated PDF missing {missing}")
        if "baltresto" in lowered or "www.baltresto.com" in lowered:
            raise RuntimeError(f"{model.slug}: supplier branding leaked into generated PDF")
        if not reader.pages:
            raise RuntimeError(f"{model.slug}: generated PDF has no pages")

        os.replace(temporary, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4321")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not LOGO.is_file():
        raise FileNotFoundError(LOGO)

    written: list[Path] = []
    for slug in MODEL_SLUGS:
        model = fetch_model(args.base_url, slug)
        target = args.output / f"{slug}-specifications.pdf"
        build_pdf(model, target, drawing_page_two=True)
        written.append(target)
        print(f"BUXENA specification: {target.name}")

    print(f"Created and verified {len(written)} BUXENA specification PDFs")


if __name__ == "__main__":
    main()
