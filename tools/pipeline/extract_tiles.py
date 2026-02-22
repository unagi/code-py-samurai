"""タイルスプライトシートからの個別タイル抽出.

処理フロー:
1. ソース画像を均等グリッド (2行×5列) で分割
2. 各セルを正方形にクロップ（下部ラベルテキスト除去）
3. rembg (u2net) で背景除去
4. 透過部分を詰めてコンテンツ領域のみの PNG として保存

実行方法:
    cd tools && uv run python pipeline/extract_tiles.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

# --- Config ---
TILE_NAMES = [
    # row 0
    ["floor-wood", "floor-stone", "floor-tatami", "wall-stone", "wall-stone-narrow"],
    # row 1
    ["wall-door-double", "wall-door-single", "stairs-wood", "stairs-stone"],
    # void は画像不要（コードで描画）
]
GRID_ROWS = 2
GRID_COLS = 5


def uniform_grid(img: Image.Image, rows: int, cols: int) -> list[tuple[int, int, int, int]]:
    """画像を rows×cols の均等グリッドに分割.

    Returns: [(x, y, w, h), ...] for each cell, row-major order.
    """
    w, h = img.size
    cw = w // cols
    ch = h // rows
    print(f"  均等分割: {rows}行 × {cols}列 = {cw}x{ch}/セル")

    cells = []
    for r in range(rows):
        for c in range(cols):
            cells.append((c * cw, r * ch, cw, ch))
    return cells


def crop_square_content(cell_img: Image.Image) -> Image.Image:
    """セル画像からラベル部分を除去し、正方形にクロップ.

    Gemini の出力はタイル画像 + 下部にファイル名ラベル。
    上部の正方形領域がタイル本体。
    """
    w, h = cell_img.size
    # ラベルは下部 ~15% にある。上部を正方形に
    sq_size = min(w, int(h * 0.85))
    sq_size = min(sq_size, w)
    # 中央揃えでクロップ
    left = (w - sq_size) // 2
    return cell_img.crop((left, 0, left + sq_size, sq_size))


def remove_background_rembg(img: Image.Image, session: object) -> Image.Image:
    """rembg (u2net) で背景を除去.

    Gemini のタイル画像は正方形クロップ済み想定。
    チェッカーボード + ダークボーダーを AI ベースで自動除去する。
    """
    return remove(img, session=session)


def tight_crop(img: Image.Image, padding: int = 2) -> Image.Image:
    """透過部分を詰めてコンテンツ領域のみにクロップ."""
    arr = np.array(img)
    if arr.shape[2] < 4:
        return img
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any():
        return img
    rmin, rmax = np.nonzero(rows)[0][[0, -1]]
    cmin, cmax = np.nonzero(cols)[0][[0, -1]]
    # パディング追加
    rmin = max(0, rmin - padding)
    rmax = min(arr.shape[0] - 1, rmax + padding)
    cmin = max(0, cmin - padding)
    cmax = min(arr.shape[1] - 1, cmax + padding)
    return img.crop((cmin, rmin, cmax + 1, rmax + 1))


def main() -> None:
    source = Path(__file__).parent.parent.parent / "from_creator" / "Gemini_Generated_Image_g49dwbg49dwbg49d.png"
    output_dir = Path(__file__).parent.parent.parent / "public" / "assets" / "tiles"

    if not source.exists():
        print(f"Error: {source} が見つかりません", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"ソース: {source.name}")
    img = Image.open(source)
    print(f"  サイズ: {img.size}")

    # rembg セッション初期化
    print("\nrembg セッション初期化...")
    session = new_session("u2net")

    # Step 1: 均等グリッド分割 (2行×5列)
    print("\nStep 1: グリッド分割")
    cells = uniform_grid(img, GRID_ROWS, GRID_COLS)
    print(f"  セル数: {len(cells)}")

    # Step 2-4: 各セルを処理
    all_names = [name for row in TILE_NAMES for name in row]
    processed = 0

    for i, (cx, cy, cw, ch) in enumerate(cells):
        if i >= len(all_names):
            print(f"  セル {i}: スキップ (void / 余剰)")
            continue

        name = all_names[i]
        print(f"\n  [{i}] {name} ({cx},{cy} {cw}x{ch})")

        # セルを切り出し
        cell = img.crop((cx, cy, cx + cw, cy + ch))

        # Step 2: 正方形にクロップ（ラベル除去）
        square = crop_square_content(cell)
        print(f"    正方形クロップ: {square.size}")

        # Step 3: rembg で背景除去
        result = remove_background_rembg(square, session)
        alpha = np.array(result)[:, :, 3]
        opaque_pct = 100 * (alpha > 10).sum() / alpha.size
        print(f"    rembg 背景除去: opaque {opaque_pct:.0f}%")

        # Step 4: コンテンツ領域にタイトクロップ
        cropped = tight_crop(result)
        print(f"    タイトクロップ: {cropped.size}")

        # 保存
        out_path = output_dir / f"{name}.png"
        cropped.save(out_path)
        print(f"    -> {out_path}")
        processed += 1

    print(f"\n完了: {processed} タイル -> {output_dir}")


if __name__ == "__main__":
    main()
