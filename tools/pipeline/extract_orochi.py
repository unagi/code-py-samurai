"""Orochi スプライト抽出パイプライン.

Gemini生成の4×5グリッド画像から:
1. 赤線検出でグリッドセルを分割
2. rembg でシアン背景を除去
3. 80×80にリサイズしてスプライトシート（横並び）を組立
4. 水平反転で逆方向を生成
5. from_creator/_extracted/orochi/ と public/assets/sprites/orochi/ に出力

実行:
    cd tools && uv run python pipeline/extract_orochi.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

# --- Config ---
FRAME_SIZE = 80  # 出力フレームサイズ (px)
RED_THRESHOLD = 150  # 赤線検出の赤チャンネル閾値
RED_DIFF = 80  # R - max(G, B) の最小差

ROWS_META = [
    {"action": "idle", "frames": 3},
    {"action": "attack", "frames": 4},
    {"action": "damaged", "frames": 2},
    {"action": "death", "frames": 4},
]


def detect_red_lines(
    arr: np.ndarray,
    expected_h: int,
    expected_v: int,
) -> tuple[list[int], list[int]]:
    """赤線セパレーターの位置を検出.

    境界線（画像端に近い線）やラベル列の線を除外し、
    期待されるグリッド内部の線のみを返す。

    Args:
        arr: ソース画像のnumpy配列
        expected_h: 期待される水平線の数（行数 - 1）
        expected_v: 期待される垂直線の数（列数 - 1）

    Returns:
        (horizontal_lines, vertical_lines) - 各線のy/x座標リスト
    """
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    red_mask = (r > RED_THRESHOLD) & ((r.astype(int) - np.maximum(g, b).astype(int)) > RED_DIFF)

    # 水平方向: 各行の赤ピクセル比率が高い行を検出
    h_ratio = red_mask.mean(axis=1)
    all_h = _find_line_centers(h_ratio, threshold=0.3)

    # 垂直方向: 各列の赤ピクセル比率が高い列を検出
    v_ratio = red_mask.mean(axis=0)
    all_v = _find_line_centers(v_ratio, threshold=0.3)

    # 境界線を除外（画像端の5%以内をスキップ）
    margin_h = int(h * 0.05)
    margin_w = int(w * 0.05)
    h_internal = [y for y in all_h if margin_h < y < h - margin_h]
    v_internal = [x for x in all_v if margin_w < x < w - margin_w]

    print(f"  All H-lines: {all_h} -> internal: {h_internal}")
    print(f"  All V-lines: {all_v} -> internal: {v_internal}")

    # 期待数より多い場合: 等間隔に最も近いセットを選択
    h_lines = _select_best_lines(h_internal, expected_h, h)
    v_lines = _select_best_lines(v_internal, expected_v, w)

    return h_lines, v_lines


def _select_best_lines(
    candidates: list[int], expected: int, total: int
) -> list[int]:
    """候補線から期待数を選択. 等間隔に近いものを優先."""
    if len(candidates) == expected:
        return candidates
    if len(candidates) < expected:
        print(f"    WARNING: Only {len(candidates)} lines found, expected {expected}")
        return candidates

    # 全組み合わせから等間隔に最も近いものを選ぶ
    from itertools import combinations

    best_score = float("inf")
    best: list[int] = candidates[:expected]

    for combo in combinations(candidates, expected):
        # 間隔の分散を計算（等間隔なら分散=0）
        intervals = []
        points = [0] + list(combo) + [total]
        for i in range(1, len(points)):
            intervals.append(points[i] - points[i - 1])
        score = np.var(intervals)
        if score < best_score:
            best_score = score
            best = list(combo)

    return best


def _find_line_centers(ratio: np.ndarray, threshold: float) -> list[int]:
    """連続する高比率区間の中心を返す."""
    above = ratio > threshold
    centers: list[int] = []
    in_run = False
    start = 0

    for i in range(len(above)):
        if above[i] and not in_run:
            start = i
            in_run = True
        elif not above[i] and in_run:
            centers.append((start + i) // 2)
            in_run = False
    if in_run:
        centers.append((start + len(above)) // 2)

    return centers


def split_grid(
    img: Image.Image, h_lines: list[int], v_lines: list[int]
) -> list[list[Image.Image]]:
    """赤線位置でグリッドセルを切り出す.

    Returns:
        rows × cols の2次元リスト
    """
    w, h = img.size

    # 行境界: [0, h_line1, h_line2, ..., h]
    y_bounds = [0] + h_lines + [h]
    x_bounds = [0] + v_lines + [w]

    grid: list[list[Image.Image]] = []
    for r in range(len(y_bounds) - 1):
        row: list[Image.Image] = []
        for c in range(len(x_bounds) - 1):
            cell = img.crop((x_bounds[c], y_bounds[r], x_bounds[c + 1], y_bounds[r + 1]))
            row.append(cell)
        grid.append(row)

    return grid


def is_empty_cell(cell: Image.Image, cyan_ratio_threshold: float = 0.85) -> bool:
    """セルがシアン単色（空セル）かどうかを判定."""
    arr = np.array(cell.convert("RGB"))
    # シアン (#00FFFF) に近いピクセルの割合
    cyan_mask = (arr[:, :, 0] < 100) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 180)
    return cyan_mask.mean() > cyan_ratio_threshold


def remove_bg(cell: Image.Image, session: object) -> Image.Image:
    """rembg でシアン背景を除去."""
    result = remove(cell.convert("RGBA"), session=session)
    return result


def clean_cyan_residue(img: Image.Image, threshold: int = 60) -> Image.Image:
    """rembg 後に残るシアン系ピクセルを透明化.

    シアン (#00FFFF) に近い色で、かつ半透明〜不透明なピクセルを
    完全透明にする。キャラ本体の色（茶・白・黒等）には影響しない。

    Args:
        img: RGBA画像
        threshold: シアンからの色距離の閾値（小さいほど厳密）
    """
    arr = np.array(img).copy()
    if arr.shape[2] < 4:
        return img

    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # シアン系: R が低く、G と B が高い
    cyan_mask = (
        (r.astype(int) < 80 + threshold)
        & (g.astype(int) > 160 - threshold)
        & (b.astype(int) > 160 - threshold)
        & (a > 0)  # 既に透明なものは無視
    )

    arr[cyan_mask, 3] = 0  # アルファを0に
    return Image.fromarray(arr)


def tight_crop(img: Image.Image, padding: int = 4) -> Image.Image:
    """透過画像のコンテンツ領域にタイトクロップ."""
    arr = np.array(img)
    if arr.shape[2] < 4:
        return img
    alpha = arr[:, :, 3]
    rows_mask = np.any(alpha > 10, axis=1)
    cols_mask = np.any(alpha > 10, axis=0)

    if not rows_mask.any() or not cols_mask.any():
        return img

    row_idx = np.nonzero(rows_mask)[0]
    col_idx = np.nonzero(cols_mask)[0]

    y1 = max(0, row_idx[0] - padding)
    y2 = min(img.height, row_idx[-1] + 1 + padding)
    x1 = max(0, col_idx[0] - padding)
    x2 = min(img.width, col_idx[-1] + 1 + padding)

    return img.crop((x1, y1, x2, y2))


def resize_to_frame(img: Image.Image, size: int = FRAME_SIZE) -> Image.Image | None:
    """フレームサイズにリサイズ（アスペクト比維持、中央配置）.

    Returns:
        リサイズ後の画像。コンテンツが空の場合はNone。
    """
    w, h = img.size
    if w == 0 or h == 0:
        return None

    scale = min(size / w, size / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # 中央配置
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)

    return canvas


def assemble_sprite_sheet(frames: list[Image.Image]) -> Image.Image:
    """フレームを横並びでスプライトシートに組立."""
    if not frames:
        raise ValueError("No frames to assemble")

    h = frames[0].height
    w = frames[0].width
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))

    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * w, 0), frame)

    return sheet


def flip_sheet(sheet: Image.Image) -> Image.Image:
    """スプライトシートを水平反転（各フレーム個別に反転）."""
    frame_h = sheet.height
    frame_w = frame_h  # 正方形フレーム想定
    n_frames = sheet.width // frame_w

    flipped = Image.new("RGBA", sheet.size, (0, 0, 0, 0))

    for i in range(n_frames):
        frame = sheet.crop((i * frame_w, 0, (i + 1) * frame_w, frame_h))
        frame_flipped = frame.transpose(Image.FLIP_LEFT_RIGHT)
        flipped.paste(frame_flipped, (i * frame_w, 0), frame_flipped)

    return flipped


def main() -> None:
    base_dir = Path(__file__).parent.parent.parent
    source_path = base_dir / "from_creator" / "gemini" / "orochi-01.png"
    meta_path = base_dir / "from_creator" / "gemini" / "orochi-01-meta.json"
    extracted_dir = base_dir / "from_creator" / "_extracted" / "orochi"
    assets_dir = base_dir / "public" / "assets" / "sprites" / "orochi"

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

    # 赤線数の検証: 行数-1本、列数-1本が期待値
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

    for row_idx, row_meta in enumerate(ROWS_META):
        action = row_meta["action"]
        n_frames = row_meta["frames"]

        if row_idx >= len(grid):
            print(f"\n  WARNING: Row {row_idx} ({action}) missing from grid")
            continue

        # ラベル行を除外: 最初の行が実際のラベル行の場合の処理
        # Gemini出力では行ラベルはセル外（左端）にあるためグリッド行は直接対応
        row_cells = grid[row_idx]

        print(f"\n  Row {row_idx}: {action} ({n_frames} frames)")

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

        if not frames:
            print(f"    WARNING: No frames extracted for {action}")
            continue

        # スプライトシート組立
        sheet = assemble_sprite_sheet(frames)
        flipped = flip_sheet(sheet)

        # Geminiが出力した方向を判定（通常は右向き）
        # → そのまま right、反転を left として保存
        right_name = f"{action}-right.png"
        left_name = f"{action}-left.png"

        # extracted に保存
        sheet.save(extracted_dir / right_name)
        flipped.save(extracted_dir / left_name)

        # assets に保存
        sheet.save(assets_dir / right_name)
        flipped.save(assets_dir / left_name)

        print(f"    -> {right_name} ({sheet.size[0]}×{sheet.size[1]})")
        print(f"    -> {left_name} (flipped)")

    print(f"\nDone! Output:")
    print(f"  Extracted: {extracted_dir}")
    print(f"  Assets:    {assets_dir}")


if __name__ == "__main__":
    main()
