"""Tsuru スプライト抽出パイプライン.

Gemini生成の3×4グリッド画像から:
1. 赤線検出でグリッドセルを分割
2. rembg でシアン背景を除去
3. 80×80にリサイズしてスプライトシート（横並び）を組立
4. rescued は Row 2-3 を結合して1シートに
5. 方向は1方向のみ（反転なし）
6. from_creator/_extracted/tsuru/ と public/assets/sprites/tsuru/ に出力

実行:
    cd tools && uv run python pipeline/extract_tsuru.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

# --- 共通関数を orochi から流用 ---
from pipeline.extract_orochi import (
    FRAME_SIZE,
    assemble_sprite_sheet,
    clean_cyan_residue,
    detect_red_lines,
    is_empty_cell,
    resize_to_frame,
    split_grid,
    tight_crop,
)


def remove_bg(cell: Image.Image, session: object) -> Image.Image:
    """rembg でシアン背景を除去 + シアン残留クリーンアップ."""
    result = remove(cell.convert("RGBA"), session=session)
    result = clean_cyan_residue(result)
    return result


def process_row_frames(
    row_cells: list[Image.Image],
    n_frames: int,
    session: object,
    label: str,
) -> list[Image.Image]:
    """行のセルからフレーム画像を抽出."""
    frames: list[Image.Image] = []
    for col_idx in range(min(n_frames, len(row_cells))):
        cell = row_cells[col_idx]

        if is_empty_cell(cell):
            print(f"    F{col_idx + 1}: EMPTY (skip)")
            continue

        # rembg 背景除去
        result = remove_bg(cell, session)

        # タイトクロップ
        cropped = tight_crop(result)

        # 80×80にリサイズ
        frame = resize_to_frame(cropped, FRAME_SIZE)
        if frame is None:
            print(f"    F{col_idx + 1}: {cell.size} -> crop {cropped.size} -> EMPTY (skip)")
            continue

        frames.append(frame)
        print(f"    F{col_idx + 1}: {cell.size} -> crop {cropped.size} -> {FRAME_SIZE}×{FRAME_SIZE}")

    return frames


def main() -> None:
    base_dir = Path(__file__).parent.parent.parent
    source_path = base_dir / "from_creator" / "gemini" / "tsuru-01.png"
    meta_path = base_dir / "from_creator" / "gemini" / "tsuru-01-meta.json"
    extracted_dir = base_dir / "from_creator" / "_extracted" / "tsuru"
    assets_dir = base_dir / "public" / "assets" / "sprites" / "tsuru"

    # Load source
    print(f"Source: {source_path.name}")
    img = Image.open(source_path).convert("RGBA")
    arr = np.array(img)
    print(f"  Size: {img.size}")

    # Load meta
    with meta_path.open(encoding="utf-8") as f:
        meta = json.load(f)
    print(f"  Meta: {meta['grid']['rows']}×{meta['grid']['cols']} grid")

    expected_rows = meta["grid"]["rows"]
    expected_cols = meta["grid"]["cols"]

    # Step 1: 赤線検出 + グリッド分割
    print("\nStep 1: Red line detection + grid split")
    h_lines, v_lines = detect_red_lines(
        arr,
        expected_h=expected_rows - 1,
        expected_v=expected_cols - 1,
    )
    print(f"  Selected H-lines: {len(h_lines)} at y={h_lines}")
    print(f"  Selected V-lines: {len(v_lines)} at x={v_lines}")

    if len(h_lines) != expected_rows - 1:
        print(f"  WARNING: Expected {expected_rows - 1} h-lines, got {len(h_lines)}")
    if len(v_lines) != expected_cols - 1:
        print(f"  WARNING: Expected {expected_cols - 1} v-lines, got {len(v_lines)}")

    grid = split_grid(img, h_lines, v_lines)
    print(f"  Grid: {len(grid)} rows × {len(grid[0]) if grid else 0} cols")

    # Step 2: rembg セッション初期化
    print("\nStep 2: rembg session init")
    session = new_session("u2net")

    # Step 3: 各行を処理
    extracted_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    # --- BOUND (Row 0): 3 frames → bound.png ---
    print("\n  Row 0: bound (3 frames)")
    bound_frames = process_row_frames(grid[0], 3, session, "bound")

    if bound_frames:
        sheet = assemble_sprite_sheet(bound_frames)
        out_name = "bound.png"
        sheet.save(extracted_dir / out_name)
        sheet.save(assets_dir / out_name)
        print(f"    -> {out_name} ({sheet.size[0]}×{sheet.size[1]})")
    else:
        print("    WARNING: No frames extracted for bound")

    # --- RESCUED (Row 1 + Row 2): 3+3=6 frames → rescued.png ---
    print("\n  Row 1: rescued part 1 (3 frames)")
    rescued_frames_1 = process_row_frames(grid[1], 3, session, "rescued-1")

    print("\n  Row 2: rescued part 2 (3 frames)")
    rescued_frames_2 = process_row_frames(grid[2], 3, session, "rescued-2")

    rescued_frames = rescued_frames_1 + rescued_frames_2
    if rescued_frames:
        sheet = assemble_sprite_sheet(rescued_frames)
        out_name = "rescued.png"
        sheet.save(extracted_dir / out_name)
        sheet.save(assets_dir / out_name)
        print(f"    -> {out_name} ({sheet.size[0]}×{sheet.size[1]})")
    else:
        print("    WARNING: No frames extracted for rescued")

    print(f"\nDone! Output:")
    print(f"  Extracted: {extracted_dir}")
    print(f"  Assets:    {assets_dir}")


if __name__ == "__main__":
    main()
