"""Tanuki スプライト抽出パイプライン.

Gemini生成の3×5グリッド画像から:
1. 赤線検出でグリッドセルを分割
2. rembg でシアン背景を除去 + シアン残留クリーンアップ
3. 80×80にリサイズしてスプライトシート（横並び）を組立
4. IDLE/CAST/DEATH/DAMAGED は水平反転で逆方向を生成
5. PROJECTILE は方向なし
6. from_creator/_extracted/tanuki/ と public/assets/sprites/tanuki/ に出力

グリッドレイアウト (3×5, ペア配置):
  Row 1: IDLE(2f) + CAST(2f) + EMPTY
  Row 2: DEATH(2f) + PROJECTILE(2f) + EMPTY
  Row 3: DAMAGED(2f) + EMPTY×3

実行:
    cd tools && uv run python -m pipeline.extract_tanuki
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

from pipeline.extract_orochi import (
    FRAME_SIZE,
    assemble_sprite_sheet,
    clean_cyan_residue,
    detect_red_lines,
    flip_sheet,
    is_empty_cell,
    resize_to_frame,
    split_grid,
    tight_crop,
)


def remove_bg(cell: Image.Image, session: object) -> Image.Image:
    """rembg でシアン背景を除去 + シアン残留クリーンアップ."""
    result = remove(cell.convert("RGBA"), session=session)
    return clean_cyan_residue(result)


def extract_frame(
    cell: Image.Image, session: object, label: str,
) -> Image.Image | None:
    """1セルからフレーム画像を抽出. 空セルの場合は None."""
    if is_empty_cell(cell):
        print(f"    {label}: EMPTY (skip)")
        return None

    result = remove_bg(cell, session)
    cropped = tight_crop(result)
    frame = resize_to_frame(cropped, FRAME_SIZE)

    if frame is None:
        print(f"    {label}: {cell.size} -> crop {cropped.size} -> EMPTY (skip)")
        return None

    print(f"    {label}: {cell.size} -> crop {cropped.size} -> {FRAME_SIZE}×{FRAME_SIZE}")
    return frame


def save_sheet(
    frames: list[Image.Image],
    name: str,
    extracted_dir: Path,
    assets_dir: Path,
) -> None:
    """フレームリストをスプライトシートとして保存."""
    if not frames:
        print(f"    WARNING: No frames for {name}")
        return
    sheet = assemble_sprite_sheet(frames)
    sheet.save(extracted_dir / name)
    sheet.save(assets_dir / name)
    print(f"    -> {name} ({sheet.size[0]}×{sheet.size[1]})")


def save_with_flip(
    frames: list[Image.Image],
    action: str,
    extracted_dir: Path,
    assets_dir: Path,
) -> None:
    """フレームリストを右向きで保存し、反転で左向きも生成."""
    save_sheet(frames, f"{action}-right.png", extracted_dir, assets_dir)
    if frames:
        sheet = assemble_sprite_sheet(frames)
        flipped = flip_sheet(sheet)
        flipped.save(extracted_dir / f"{action}-left.png")
        flipped.save(assets_dir / f"{action}-left.png")
        print(f"    -> {action}-left.png (flipped)")


def main() -> None:
    base_dir = Path(__file__).parent.parent.parent
    source_path = base_dir / "from_creator" / "gemini" / "tanuki-01.png"
    extracted_dir = base_dir / "from_creator" / "_extracted" / "tanuki"
    assets_dir = base_dir / "public" / "assets" / "sprites" / "tanuki"

    # Load source
    print(f"Source: {source_path.name}")
    img = Image.open(source_path).convert("RGBA")
    arr = np.array(img)
    print(f"  Size: {img.size}")

    # Step 1: 赤線検出 + グリッド分割
    print("\nStep 1: Red line detection + grid split")
    h_lines, v_lines = detect_red_lines(arr, expected_h=2, expected_v=4)
    print(f"  H-lines: {len(h_lines)} at y={h_lines}")
    print(f"  V-lines: {len(v_lines)} at x={v_lines}")

    grid = split_grid(img, h_lines, v_lines)
    print(f"  Grid: {len(grid)} rows × {len(grid[0]) if grid else 0} cols")

    # Step 2: rembg セッション初期化
    print("\nStep 2: rembg session init")
    session = new_session("u2net")

    extracted_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    # ── Row 1: IDLE(2f) + CAST(2f) ──────────────────────────
    print("\n  Row 1: IDLE(2f) + CAST(2f)")
    row = grid[0]

    idle_frames: list[Image.Image] = []
    for i in range(2):
        f = extract_frame(row[i], session, f"IDLE-F{i + 1}")
        if f:
            idle_frames.append(f)

    cast_frames: list[Image.Image] = []
    for i in range(2, 4):
        f = extract_frame(row[i], session, f"CAST-F{i - 1}")
        if f:
            cast_frames.append(f)

    # ── Row 2: DEATH(2f) + PROJECTILE(2f) ────────────────────
    print("\n  Row 2: DEATH(2f) + PROJECTILE(2f)")
    row = grid[1]

    death_frames: list[Image.Image] = []
    for i in range(2):
        f = extract_frame(row[i], session, f"DEATH-F{i + 1}")
        if f:
            death_frames.append(f)

    proj_frames: list[Image.Image] = []
    for i in range(2, 4):
        f = extract_frame(row[i], session, f"PROJ-F{i - 1}")
        if f:
            proj_frames.append(f)

    # ── Row 3: DAMAGED(2f) ───────────────────────────────────
    print("\n  Row 3: DAMAGED(2f)")
    row = grid[2]

    damaged_frames: list[Image.Image] = []
    for i in range(2):
        f = extract_frame(row[i], session, f"DAMAGED-F{i + 1}")
        if f:
            damaged_frames.append(f)

    # ── スプライトシート組立 & 保存 ─────────────────────────
    print("\n  Assembling sprite sheets...")

    # IDLE/CAST/DEATH/DAMAGED: 反転で左右生成
    save_with_flip(idle_frames, "idle", extracted_dir, assets_dir)
    save_with_flip(cast_frames, "cast", extracted_dir, assets_dir)
    save_with_flip(death_frames, "death", extracted_dir, assets_dir)
    save_with_flip(damaged_frames, "damaged", extracted_dir, assets_dir)

    # PROJECTILE: 方向なし
    save_sheet(proj_frames, "projectile-flame.png", extracted_dir, assets_dir)

    print(f"\nDone! Output:")
    print(f"  Extracted: {extracted_dir}")
    print(f"  Assets:    {assets_dir}")


if __name__ == "__main__":
    main()
