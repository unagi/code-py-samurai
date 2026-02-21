"""Phase 5-6: Geometric normalization + Resize + Sprite sheet assembly.

Takes extracted frames from Phase 1 and produces:
- 80×80px normalized individual frames
- Sprite sheets (horizontal strip) for each action-direction
- Tiles at 80×80px

SPRITE_SPEC constraints:
- Canvas: 80×80px
- Effective drawing area: 48×48px (center-top)
- Forbidden zone: bottom-right 20×20px (watermark area)
- Game engine reads 80px frames, renders center 48px

Normalization strategy:
- warrior-01/02/03 (4-row source): scale factor based on standing height
- warrior-04 (2-row source): half the scale factor (2x larger source pixels)
- Anchor: bottom-center of character aligned to consistent canvas position
- Cross-action consistency: same scale for same source resolution
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


# ── Constants ──────────────────────────────────────────────────────
CANVAS_SIZE = 80
EFFECTIVE_SIZE = 48
FORBIDDEN_BR = 20

# Effective area position (center-top of 80×80)
EFF_X0 = (CANVAS_SIZE - EFFECTIVE_SIZE) // 2  # 16
EFF_Y0 = 6  # top margin
EFF_X1 = EFF_X0 + EFFECTIVE_SIZE  # 64
EFF_Y1 = EFF_Y0 + EFFECTIVE_SIZE  # 54

# Character anchor: bottom-center within effective area
ANCHOR_X = CANVAS_SIZE // 2  # 40
ANCHOR_Y = EFF_Y1  # 54 (bottom of effective area)


# ── Configuration ──────────────────────────────────────────────────
@dataclass
class SourceConfig:
    """Configuration for a source image group."""

    source_dir: str
    action: str
    directions: list[str]
    frames_per_dir: int
    source_rows: int  # 4 or 2 (affects scale factor)


WARRIOR_SOURCES = [
    SourceConfig("warrior-01", "idle", ["north", "east", "south", "west"], 4, 4),
    SourceConfig("warrior-02", "walk", ["north", "east", "south", "west"], 6, 4),
    SourceConfig("warrior-03", "attack", ["north", "east", "south", "west"], 6, 4),
    SourceConfig("warrior-04", "rest", ["left", "right"], 4, 2),
]


# ── Helpers ────────────────────────────────────────────────────────
def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """Get bounding box of non-transparent content (x0, y0, x1, y1)."""
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        return (0, 0, img.width, img.height)
    return bbox


def determine_scale_factors(
    extracted_dir: Path,
) -> dict[str, float]:
    """Determine scale factors for each source based on character height.

    Strategy: measure max content height per source, then scale so
    the tallest standing character fits within EFFECTIVE_SIZE with margin.
    4-row sources share one scale, 2-row sources get half (since pixels are 2x).
    """
    max_heights: dict[int, list[int]] = {4: [], 2: []}

    for cfg in WARRIOR_SOURCES:
        src_dir = extracted_dir / cfg.source_dir
        if not src_dir.exists():
            continue
        for direction in cfg.directions:
            for fi in range(cfg.frames_per_dir):
                fname = f"{cfg.action}-{direction}-f{fi}.png"
                fpath = src_dir / fname
                if not fpath.exists():
                    continue
                img = Image.open(fpath)
                x0, y0, x1, y1 = content_bbox(img)
                h = y1 - y0
                max_heights[cfg.source_rows].append(h)

    # Target: character fits within effective area with small margin
    target_h = EFFECTIVE_SIZE - 4  # 44px, leaving 2px top + 2px bottom margin

    scales: dict[str, float] = {}
    for cfg in WARRIOR_SOURCES:
        heights = max_heights.get(cfg.source_rows, [])
        if not heights:
            continue
        max_h = max(heights)
        scale = target_h / max_h
        scales[cfg.source_dir] = scale
        print(f"  {cfg.source_dir} ({cfg.source_rows}-row): "
              f"max_h={max_h}px, scale={scale:.4f}")

    return scales


def normalize_frame(
    img: Image.Image,
    scale: float,
) -> Image.Image:
    """Normalize a single frame: scale and place on 80×80 canvas.

    The character is placed with:
    - Horizontal: content center at ANCHOR_X (40)
    - Vertical: content bottom at ANCHOR_Y (54)
    """
    # Get content bounds
    x0, y0, x1, y1 = content_bbox(img)
    content_w = x1 - x0
    content_h = y1 - y0

    # Scale content
    new_w = max(1, round(content_w * scale))
    new_h = max(1, round(content_h * scale))

    # Crop to content then resize
    cropped = img.crop((x0, y0, x1, y1))
    scaled = cropped.resize((new_w, new_h), Image.LANCZOS)

    # Create 80×80 canvas
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

    # Position: bottom-center anchor
    paste_x = ANCHOR_X - new_w // 2
    paste_y = ANCHOR_Y - new_h

    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return canvas


def normalize_tile(
    img: Image.Image,
    tile_name: str,
) -> Image.Image:
    """Normalize a tile: resize to fill effective area, place on 80×80 canvas."""
    if tile_name == "void":
        # Void: solid black, fill entire canvas
        return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 255))

    # Get content bounds (remove checkerboard remnants)
    x0, y0, x1, y1 = content_bbox(img)
    cropped = img.crop((x0, y0, x1, y1))

    # Resize to fill effective area while maintaining aspect ratio
    content_w = x1 - x0
    content_h = y1 - y0
    scale = min(EFFECTIVE_SIZE / content_w, EFFECTIVE_SIZE / content_h)
    new_w = max(1, round(content_w * scale))
    new_h = max(1, round(content_h * scale))
    scaled = cropped.resize((new_w, new_h), Image.LANCZOS)

    # For tiles, make opaque (composite on solid background matching the tile)
    # First, remove alpha for non-transparent tiles
    if tile_name not in ("stairs-wood", "stairs-stone"):
        # Fill transparent pixels with edge color
        bg = Image.new("RGBA", scaled.size, _dominant_edge_color(scaled))
        bg.paste(scaled, (0, 0), scaled)
        scaled = bg

    # Create 80×80 canvas
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

    # Center the tile in the effective area
    paste_x = EFF_X0 + (EFFECTIVE_SIZE - new_w) // 2
    paste_y = EFF_Y0 + (EFFECTIVE_SIZE - new_h) // 2
    canvas.paste(scaled, (paste_x, paste_y), scaled)

    return canvas


def _dominant_edge_color(img: Image.Image) -> tuple[int, int, int, int]:
    """Get the most common edge color of an image."""
    pixels = list(img.getdata())
    w = img.width
    h = img.height
    edge_pixels = []
    for i, p in enumerate(pixels):
        x, y = i % w, i // w
        if x == 0 or x == w - 1 or y == 0 or y == h - 1:
            if len(p) == 4 and p[3] > 128:  # Only opaque pixels
                edge_pixels.append(p)
    if not edge_pixels:
        return (0, 0, 0, 255)
    # Return the average
    r = sum(p[0] for p in edge_pixels) // len(edge_pixels)
    g = sum(p[1] for p in edge_pixels) // len(edge_pixels)
    b = sum(p[2] for p in edge_pixels) // len(edge_pixels)
    return (r, g, b, 255)


def assemble_sprite_sheet(
    frames: list[Image.Image],
) -> Image.Image:
    """Assemble frames into a horizontal sprite sheet."""
    n = len(frames)
    sheet = Image.new("RGBA", (CANVAS_SIZE * n, CANVAS_SIZE), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * CANVAS_SIZE, 0), frame)
    return sheet


# ── Main ───────────────────────────────────────────────────────────
def main() -> None:
    project_root = Path(__file__).parent.parent
    extracted_dir = project_root / "from_creator" / "gemini" / "_extracted"
    output_sprites = project_root / "public" / "assets" / "sprites" / "samurai-cat"
    output_tiles = project_root / "public" / "assets" / "tiles"

    output_sprites.mkdir(parents=True, exist_ok=True)
    output_tiles.mkdir(parents=True, exist_ok=True)

    print("=== Phase 5-6: Normalize + Assemble ===\n")

    # Step 1: Determine scale factors
    print("[1/3] Determining scale factors...")
    scales = determine_scale_factors(extracted_dir)
    print()

    # Step 2: Process warrior frames
    print("[2/3] Processing warrior frames...")
    for cfg in WARRIOR_SOURCES:
        scale = scales.get(cfg.source_dir)
        if scale is None:
            print(f"  SKIP {cfg.source_dir}: no scale factor")
            continue

        src_dir = extracted_dir / cfg.source_dir

        for direction in cfg.directions:
            frames: list[Image.Image] = []
            for fi in range(cfg.frames_per_dir):
                fname = f"{cfg.action}-{direction}-f{fi}.png"
                fpath = src_dir / fname
                if not fpath.exists():
                    print(f"  WARN: missing {fname}")
                    continue
                img = Image.open(fpath).convert("RGBA")
                normalized = normalize_frame(img, scale)
                frames.append(normalized)

            if not frames:
                continue

            # Assemble sprite sheet
            sheet = assemble_sprite_sheet(frames)
            sheet_name = f"{cfg.action}-{direction}.png"
            sheet_path = output_sprites / sheet_name
            sheet.save(sheet_path, "PNG")
            print(f"  {sheet_name}: {len(frames)}f → {sheet.width}×{sheet.height}")

    print()

    # Step 3: Process tiles
    print("[3/3] Processing tiles...")
    tiles_dir = extracted_dir / "tiles-01"
    if tiles_dir.exists():
        for tile_file in sorted(tiles_dir.iterdir()):
            if not tile_file.suffix == ".png":
                continue
            tile_name = tile_file.stem
            img = Image.open(tile_file).convert("RGBA")
            normalized = normalize_tile(img, tile_name)
            out_path = output_tiles / tile_file.name
            normalized.save(out_path, "PNG")
            print(f"  {tile_file.name}: {img.width}×{img.height} → "
                  f"{CANVAS_SIZE}×{CANVAS_SIZE}")

    print("\n=== Done ===")
    print(f"Sprites: {output_sprites}")
    print(f"Tiles:   {output_tiles}")


if __name__ == "__main__":
    main()
