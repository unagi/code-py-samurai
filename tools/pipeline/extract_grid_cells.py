"""汎用グリッド分割: Gemini生成スプライトシートを個別セル画像に分離.

- 赤セパレータ線の自動検出でグリッド位置を特定
- 各セルの背景除去 (rembg or floodfill)
- r{row}c{col}.png 形式で保存（意味的ラベルは後工程で付与）

実行:
    cd tools && uv run python pipeline/extract_grid_cells.py <input.png> -o <output_dir> --rows 4 --cols 5
    cd tools && uv run python pipeline/extract_grid_cells.py <input.png> -o <output_dir> --rows 4 --cols 7 --bg-mode floodfill
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def detect_red_separators(
    img_arr: np.ndarray,
    *,
    red_threshold: int = 150,
    other_max: int = 100,
    min_line_ratio: float = 0.3,
) -> tuple[list[int], list[int]]:
    """赤いセパレータ線の位置を検出.

    Returns:
        (row_separators, col_separators): 赤線の y/x 座標リスト
    """
    h, w = img_arr.shape[:2]
    r, g, b = img_arr[:, :, 0], img_arr[:, :, 1], img_arr[:, :, 2]
    red_mask = (r > red_threshold) & (g < other_max) & (b < other_max)

    # 水平方向: 各行の赤ピクセル比率
    h_ratio = np.mean(red_mask, axis=1)
    row_seps = _find_line_centers(h_ratio, min_line_ratio)

    # 垂直方向: 各列の赤ピクセル比率
    v_ratio = np.mean(red_mask, axis=0)
    col_seps = _find_line_centers(v_ratio, min_line_ratio)

    return row_seps, col_seps


def _find_line_centers(ratio: np.ndarray, threshold: float, *, merge_gap: int = 10) -> list[int]:
    """閾値を超える連続区間の中心座標を返す.

    merge_gap: この距離以内の隣接検出をマージする（赤線の微小ギャップ対策）
    """
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

    # 隣接するセパレータをマージ
    if len(centers) <= 1:
        return centers
    merged: list[int] = [centers[0]]
    for c in centers[1:]:
        if c - merged[-1] < merge_gap:
            merged[-1] = (merged[-1] + c) // 2
        else:
            merged.append(c)
    return merged


def compute_cell_rects(
    img_h: int,
    img_w: int,
    row_seps: list[int],
    col_seps: list[int],
    expected_rows: int,
    expected_cols: int,
) -> list[list[tuple[int, int, int, int]]]:
    """セパレータ位置からセルの (x, y, w, h) を計算.

    Returns:
        rows × cols の2次元リスト
    """
    # 行境界: [0, sep1, sep2, ..., img_h]
    y_bounds = [0] + row_seps + [img_h]
    x_bounds = [0] + col_seps + [img_w]

    if len(y_bounds) - 1 != expected_rows:
        print(
            f"WARN: 行セパレータから {len(y_bounds) - 1} 行検出 (期待 {expected_rows})",
            file=sys.stderr,
        )
    if len(x_bounds) - 1 != expected_cols:
        print(
            f"WARN: 列セパレータから {len(x_bounds) - 1} 列検出 (期待 {expected_cols})",
            file=sys.stderr,
        )

    grid: list[list[tuple[int, int, int, int]]] = []
    for r in range(min(expected_rows, len(y_bounds) - 1)):
        row: list[tuple[int, int, int, int]] = []
        for c in range(min(expected_cols, len(x_bounds) - 1)):
            y0, y1 = y_bounds[r], y_bounds[r + 1]
            x0, x1 = x_bounds[c], x_bounds[c + 1]
            # セパレータ線自体を除外するマージン
            margin = 3
            row.append((x0 + margin, y0 + margin, x1 - x0 - 2 * margin, y1 - y0 - 2 * margin))
        grid.append(row)
    return grid


def _flatten_onto_white(rgba_arr: np.ndarray) -> np.ndarray:
    """RGBA 配列を白背景に合成した RGB 配列を返す.

    部分透過済み画像のエッジ (RGB=0,A=0) を白に戻し、
    背景検出を可能にする。
    """
    h, w = rgba_arr.shape[:2]
    alpha_f = rgba_arr[:, :, 3].astype(np.float32) / 255.0
    flat = np.empty((h, w, 3), dtype=np.uint8)
    for c in range(3):
        flat[:, :, c] = np.clip(
            rgba_arr[:, :, c].astype(np.float32) * alpha_f + 255.0 * (1.0 - alpha_f),
            0, 255,
        ).astype(np.uint8)
    return flat


def remove_white_bg_floodfill(
    img: Image.Image,
    *,
    white_threshold: int = 220,
    flood_tolerance: int = 30,
    opaque_floor: int = 128,
) -> Image.Image:
    """白背景を connected components で検出して透過に変換.

    部分透過済み (rembg 処理済み) 画像にも対応:
    - 既に透過のピクセル (A=0) は一切変更しない
    - 不透明な白ピクセルのみ背景候補とする
    - 画像エッジ or 既存透過領域に隣接する白コンポーネントを背景として除去
    - キャラクター内部の白 (目・ハイライト等) は保持

    rembg と異なり AI 推定しないため、尻尾や細い部位が切れない。

    Args:
        white_threshold: 白とみなす閾値 (RGB各チャンネル)
        flood_tolerance: (後方互換のため残存、現在は未使用)
        opaque_floor: 不透明とみなす最低 alpha 値
    """
    from scipy.ndimage import binary_dilation, label as ndlabel

    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]

    # 部分透過済み画像対応: 白背景に合成 (閾値判定用)
    flat_rgb = _flatten_onto_white(arr)

    # 不透明な白ピクセルのみ背景候補とする (A=0 は除外)
    opaque = arr[:, :, 3] >= opaque_floor
    white_flat = np.all(flat_rgb > white_threshold, axis=2)
    opaque_white = opaque & white_flat

    # connected components (不透明な白ピクセルのみ)
    labeled, _num_features = ndlabel(opaque_white)

    # 背景コンポーネント = エッジ接触 or 既存透過領域に隣接
    transparent = arr[:, :, 3] == 0
    near_transparent = binary_dilation(transparent, iterations=1) & ~transparent

    bg_labels: set[int] = set()

    # (a) 画像エッジに接する白コンポーネント
    for x in range(w):
        if labeled[0, x] > 0:
            bg_labels.add(int(labeled[0, x]))
        if labeled[h - 1, x] > 0:
            bg_labels.add(int(labeled[h - 1, x]))
    for y in range(h):
        if labeled[y, 0] > 0:
            bg_labels.add(int(labeled[y, 0]))
        if labeled[y, w - 1] > 0:
            bg_labels.add(int(labeled[y, w - 1]))

    # (b) 既存の透過ピクセルに隣接する白コンポーネント
    for y_s, x_s in zip(*np.nonzero(near_transparent & opaque_white)):
        lbl = int(labeled[y_s, x_s])
        if lbl > 0:
            bg_labels.add(lbl)

    bg_mask = np.isin(labeled, list(bg_labels))

    # アンチエイリアス処理: 背景隣接ピクセルの alpha を輝度に応じて削減
    border = binary_dilation(bg_mask, iterations=1) & ~bg_mask & opaque
    for y_b, x_b in zip(*np.nonzero(border)):
        r, g, b = int(flat_rgb[y_b, x_b, 0]), int(flat_rgb[y_b, x_b, 1]), int(flat_rgb[y_b, x_b, 2])
        brightness = (r + g + b) / 3
        if brightness > white_threshold:
            arr[y_b, x_b, 3] = 0
        elif brightness > 180:
            alpha_ratio = max(0.0, 1.0 - (brightness - 180) / (white_threshold - 180))
            arr[y_b, x_b, 3] = int(arr[y_b, x_b, 3] * alpha_ratio)

    arr[bg_mask, 3] = 0

    # 赤セパレータの残留ピクセルも除去
    red_mask = (arr[:, :, 0] > 150) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
    arr[red_mask, 3] = 0

    return Image.fromarray(arr)


def tight_crop(img: Image.Image, padding: int = 4) -> Image.Image:
    """透明部分を除いてタイトクロップ."""
    alpha = np.array(img.split()[-1])
    rows_mask = np.any(alpha > 10, axis=1)
    cols_mask = np.any(alpha > 10, axis=0)

    if not np.any(rows_mask) or not np.any(cols_mask):
        return img

    row_idx = np.nonzero(rows_mask)[0]
    col_idx = np.nonzero(cols_mask)[0]

    y1 = max(0, row_idx[0] - padding)
    y2 = min(img.height, row_idx[-1] + 1 + padding)
    x1 = max(0, col_idx[0] - padding)
    x2 = min(img.width, col_idx[-1] + 1 + padding)

    return img.crop((x1, y1, x2, y2))


def create_rembg_session():
    """rembg セッション作成 (遅延インポート)."""
    from rembg import new_session

    sess = new_session(
        "u2net",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    if hasattr(sess, "inner_session"):
        inner = sess.inner_session
        if hasattr(inner, "get_providers"):
            providers = inner.get_providers()
            gpu = "CUDAExecutionProvider" in providers
            print(f"  rembg: {'GPU (CUDA)' if gpu else 'CPU'}")
    return sess


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini スプライトシートをセル分離")
    parser.add_argument("input", type=Path, help="入力画像")
    parser.add_argument("-o", "--output", type=Path, required=True, help="出力ディレクトリ")
    parser.add_argument("--rows", type=int, default=4, help="グリッド行数")
    parser.add_argument("--cols", type=int, default=5, help="グリッド列数")
    parser.add_argument(
        "--bg-mode",
        choices=["rembg", "floodfill", "none"],
        default="floodfill",
        help="背景除去モード: floodfill (推奨), rembg (AI), none",
    )
    # 後方互換
    parser.add_argument("--skip-rembg", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.skip_rembg:
        args.bg_mode = "none"

    if not args.input.exists():
        print(f"Error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    args.output.mkdir(parents=True, exist_ok=True)

    print(f"Input: {args.input}")
    print(f"Grid: {args.rows}×{args.cols}")
    print(f"BG removal: {args.bg_mode}")

    img = Image.open(args.input).convert("RGBA")
    arr = np.array(img)
    print(f"Size: {img.width}×{img.height}")

    # 赤セパレータ検出（外枠の赤線を除外）
    row_seps_raw, col_seps_raw = detect_red_separators(arr[:, :, :3])
    edge_margin = min(img.width, img.height) * 0.03
    row_seps = [y for y in row_seps_raw if edge_margin < y < img.height - edge_margin]
    col_seps = [x for x in col_seps_raw if edge_margin < x < img.width - edge_margin]
    print(f"Row separators: {row_seps} ({len(row_seps)} internal lines)")
    print(f"Col separators: {col_seps} ({len(col_seps)} internal lines)")

    grid = compute_cell_rects(
        img.height, img.width, row_seps, col_seps, args.rows, args.cols,
    )

    rembg_session = None
    if args.bg_mode == "rembg":
        print("Initializing rembg...")
        rembg_session = create_rembg_session()

    count = 0
    for r, row in enumerate(grid):
        for c, (x, y, w, h) in enumerate(row):
            cell_img = img.crop((x, y, x + w, y + h))

            if args.bg_mode == "rembg":
                from rembg import remove

                cell_img = remove(cell_img, session=rembg_session)
            elif args.bg_mode == "floodfill":
                cell_img = remove_white_bg_floodfill(cell_img)

            cell_img = tight_crop(cell_img)

            name = f"r{r + 1}c{c + 1}.png"
            cell_img.save(args.output / name, "PNG")
            print(f"  {name}: {cell_img.width}×{cell_img.height}")
            count += 1

    print(f"\nDone: {count} cells -> {args.output}")


if __name__ == "__main__":
    main()
