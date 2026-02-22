"""Phase 1: rembg (GPU) 背景除去 + フレーム分離スクリプト.

処理フロー:
1. ソース画像を8xダウンサンプリングし、明度閾値+連結成分分析でグリッドセルを検出
2. meta.jsonの行数・列数に基づいてセルをフレームに割り当て
3. 各セルを個別にrembg (CUDA) で背景除去
4. キャラクター領域にタイトクロップして個別PNGとして保存

実行方法:
    # 環境変数PATHにcuDNN/cuBLAS DLLを含めて実行
    # (run.sh から呼び出す想定)
    uv run python phase1_extract.py [samurai-01|samurai-02|...|tiles-01|all]
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

# --- Constants ---
DOWNSAMPLE_FACTOR = 8
BRIGHTNESS_THRESHOLD = 55
EROSION_KERNEL_SIZE = 3
EROSION_ITERATIONS = 1
MIN_CELL_AREA = 400  # downsampled pixel area
ROW_GAP_THRESHOLD = 200  # original pixels
CONTENT_PADDING = 4  # pixels around content


@dataclass(frozen=True)
class CellInfo:
    """グリッドセルの情報（ソース画像座標系）."""

    x: int
    y: int
    w: int
    h: int
    center_x: float
    center_y: float


def _create_gpu_session():
    """rembg GPUセッションを作成."""
    sess = new_session(
        "u2net",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    # Verify CUDA is active
    if hasattr(sess, "inner_session"):
        inner = sess.inner_session
        if hasattr(inner, "get_providers"):
            providers = inner.get_providers()
            if "CUDAExecutionProvider" in providers:
                print("  GPU: CUDAExecutionProvider active")
            else:
                print(f"  WARNING: CUDA not active, using: {providers}")
    return sess


def load_meta(meta_path: Path) -> dict:
    """meta.jsonを読み込む."""
    with meta_path.open(encoding="utf-8") as f:
        return json.load(f)


def detect_grid_cells(
    img_arr: np.ndarray,
) -> list[CellInfo]:
    """ダウンサンプリング + 連結成分分析でグリッドセルを検出.

    チェッカーボード背景は8xダウンサンプリングで平均化され中間グレーに、
    ダーク背景は暗いままなので、明度閾値で分離可能。

    Returns:
        検出されたセル情報のリスト（未ソート）
    """
    h, w = img_arr.shape[:2]
    ds = DOWNSAMPLE_FACTOR

    # 余りが出ないようにクロップ
    ch = (h // ds) * ds
    cw = (w // ds) * ds
    cropped = img_arr[:ch, :cw, :3]

    # 8xダウンサンプリング（平均プーリング）
    small = cropped.reshape(ch // ds, ds, cw // ds, ds, 3).mean(axis=(1, 3))
    brightness = np.mean(small, axis=2)

    # 二値化: 明るい領域 = コンテンツ（チェッカーボード+キャラ）
    binary = (brightness > BRIGHTNESS_THRESHOLD).astype(np.uint8) * 255

    # 軽い侵食で隣接セルの接触を切断
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (EROSION_KERNEL_SIZE, EROSION_KERNEL_SIZE)
    )
    eroded = cv2.erode(binary, kernel, iterations=EROSION_ITERATIONS)

    # 連結成分分析
    num_labels, _labels, stats, centroids = cv2.connectedComponentsWithStats(
        eroded, connectivity=8
    )

    cells: list[CellInfo] = []
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < MIN_CELL_AREA:
            continue

        cells.append(
            CellInfo(
                x=stats[i, cv2.CC_STAT_LEFT] * ds,
                y=stats[i, cv2.CC_STAT_TOP] * ds,
                w=stats[i, cv2.CC_STAT_WIDTH] * ds,
                h=stats[i, cv2.CC_STAT_HEIGHT] * ds,
                center_x=centroids[i][0] * ds,
                center_y=centroids[i][1] * ds,
            )
        )

    return cells


def assign_cells_to_grid(
    cells: list[CellInfo],
    expected_rows: int,
    frames_per_row: list[int],
) -> list[list[CellInfo]]:
    """検出セルをグリッドに割り当てる.

    Returns:
        行×列の2次元リスト
    """
    if not cells:
        raise ValueError("No cells detected")

    # y座標でソートし、ギャップでクラスタリングして行を形成
    sorted_by_y = sorted(cells, key=lambda c: c.center_y)

    rows: list[list[CellInfo]] = [[sorted_by_y[0]]]
    for i in range(1, len(sorted_by_y)):
        gap = sorted_by_y[i].center_y - sorted_by_y[i - 1].center_y
        if gap > ROW_GAP_THRESHOLD:
            rows.append([sorted_by_y[i]])
        else:
            rows[-1].append(sorted_by_y[i])

    if len(rows) != expected_rows:
        raise ValueError(
            f"Row count mismatch: detected {len(rows)}, expected {expected_rows}"
        )

    # 各行内をx座標でソート
    for row in rows:
        row.sort(key=lambda c: c.center_x)

    # 行内セル数が多すぎる場合: 隣接セルをマージして期待数に合わせる
    for i, (row, expected) in enumerate(zip(rows, frames_per_row)):
        if len(row) > expected:
            print(
                f"  Row {i}: {len(row)} cells detected, "
                f"merging to {expected}..."
            )
            rows[i] = _merge_cells_to_count(row, expected)
        elif len(row) < expected:
            print(
                f"  WARNING: Row {i}: {len(row)} cells detected, "
                f"expected {expected}"
            )

    return rows


def _merge_cells_to_count(
    cells: list[CellInfo], target: int
) -> list[CellInfo]:
    """行内の過剰セルを隣接マージで目標数に削減.

    最も近い隣接ペアを優先的にマージする。
    """
    current = list(cells)

    while len(current) > target:
        # 隣接ペア間の距離を計算
        min_gap = float("inf")
        merge_idx = 0
        for j in range(len(current) - 1):
            gap = current[j + 1].x - (current[j].x + current[j].w)
            if gap < min_gap:
                min_gap = gap
                merge_idx = j

        # マージ: 2つのセルを包含する1つのセルに
        a, b = current[merge_idx], current[merge_idx + 1]
        merged_x = min(a.x, b.x)
        merged_y = min(a.y, b.y)
        merged_x2 = max(a.x + a.w, b.x + b.w)
        merged_y2 = max(a.y + a.h, b.y + b.h)

        merged = CellInfo(
            x=merged_x,
            y=merged_y,
            w=merged_x2 - merged_x,
            h=merged_y2 - merged_y,
            center_x=(merged_x + merged_x2) / 2,
            center_y=(merged_y + merged_y2) / 2,
        )
        current[merge_idx : merge_idx + 2] = [merged]

    return current


def tight_crop(
    img: Image.Image, padding: int = CONTENT_PADDING
) -> Image.Image:
    """透過画像のコンテンツ領域にタイトクロップ."""
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


def process_samurai(
    source_path: Path,
    meta: dict,
    output_dir: Path,
    session,
) -> list[Path]:
    """samurai系画像を処理."""
    print(f"\n=== {source_path.name} ===")

    img = Image.open(source_path).convert("RGBA")
    arr = np.array(img)
    print(f"  Size: {img.size}")

    # Step 1: グリッド検出
    cells = detect_grid_cells(arr)
    rows_meta = meta["rows"]
    expected_rows = len(rows_meta)
    frames_per_row = [r["totalFramesVisible"] for r in rows_meta]
    total_expected = sum(frames_per_row)

    print(f"  Detected {len(cells)} cells, expected {total_expected}")

    grid = assign_cells_to_grid(cells, expected_rows, frames_per_row)

    # Step 2: 各セルをrembgで処理
    output_dir.mkdir(parents=True, exist_ok=True)
    debug_dir = output_dir / "_debug"
    debug_dir.mkdir(exist_ok=True)

    output_files: list[Path] = []
    t_start = time.perf_counter()

    for row_idx, (row_cells, row_meta) in enumerate(zip(grid, rows_meta)):
        action = row_meta["action"]
        direction = row_meta["direction"]

        for frame_idx, cell in enumerate(row_cells):
            # セルを切り出し
            cell_img = img.crop((cell.x, cell.y, cell.x + cell.w, cell.y + cell.h))

            # rembg背景除去
            result = remove(cell_img, session=session)

            # タイトクロップ
            result = tight_crop(result)

            # 保存
            filename = f"{action}-{direction}-f{frame_idx}.png"
            out_path = output_dir / filename
            result.save(out_path)
            output_files.append(out_path)

            print(f"  {filename}: {result.size[0]}x{result.size[1]}")

    elapsed = time.perf_counter() - t_start
    print(f"\n  Output: {len(output_files)} files -> {output_dir}")
    print(f"  Time: {elapsed:.1f}s ({elapsed / len(output_files):.2f}s/frame)")
    return output_files


def _infer_grid_from_cells(
    cells: list[CellInfo],
    expected_rows: int,
    expected_cols: int,
    img_width: int,
    img_height: int,
) -> list[list[CellInfo]]:
    """検出セルの位置パターンからフルグリッドを推定.

    暗いタイル（void等）が検出されない場合でも、
    検出済みセルの間隔からグリッド全体を再構築する。
    """
    if not cells:
        # フォールバック: 均等分割
        return _uniform_grid(expected_rows, expected_cols, img_width, img_height)

    # 検出セルのx, yをクラスタリングしてグリッドの列位置・行位置を推定
    xs = sorted(set(c.x for c in cells))
    ys = sorted(set(c.y for c in cells))

    # 代表的なセルサイズを中央値から推定
    widths = [c.w for c in cells]
    heights = [c.h for c in cells]
    median_w = int(np.median(widths))
    median_h = int(np.median(heights))

    # 行のy座標をクラスタリング
    row_ys = _cluster_positions([c.center_y for c in cells], expected_rows)
    col_xs = _cluster_positions([c.center_x for c in cells], expected_cols)

    # 足りない行・列を等間隔で補完
    if len(row_ys) < expected_rows:
        row_ys = _fill_positions(row_ys, expected_rows, median_h, img_height)
    if len(col_xs) < expected_cols:
        col_xs = _fill_positions(col_xs, expected_cols, median_w, img_width)

    # グリッド構築
    grid: list[list[CellInfo]] = []
    for ry in row_ys[:expected_rows]:
        row: list[CellInfo] = []
        for cx in col_xs[:expected_cols]:
            x = max(0, int(cx - median_w / 2))
            y = max(0, int(ry - median_h / 2))
            row.append(CellInfo(x=x, y=y, w=median_w, h=median_h,
                                center_x=cx, center_y=ry))
        grid.append(row)

    return grid


def _cluster_positions(values: list[float], expected: int) -> list[float]:
    """1Dの座標値をクラスタリングして代表値を返す."""
    sorted_vals = sorted(values)
    if len(sorted_vals) <= expected:
        return sorted_vals

    # ギャップで分割
    clusters: list[list[float]] = [[sorted_vals[0]]]
    for i in range(1, len(sorted_vals)):
        if sorted_vals[i] - sorted_vals[i - 1] > 100:  # gap threshold
            clusters.append([sorted_vals[i]])
        else:
            clusters[-1].append(sorted_vals[i])

    return [np.mean(c) for c in clusters]


def _fill_positions(
    existing: list[float], target: int, _cell_size: int, total_size: int
) -> list[float]:
    """検出済み位置から等間隔で欠損位置を補完."""
    if len(existing) >= 2:
        spacing = (existing[-1] - existing[0]) / (len(existing) - 1)
    else:
        spacing = total_size / target

    # 検出済みの最初の位置を基準に等間隔生成
    first = existing[0] if existing else spacing / 2
    return [first + i * spacing for i in range(target)]


def _uniform_grid(
    rows: int, cols: int, img_w: int, img_h: int
) -> list[list[CellInfo]]:
    """均等分割によるフォールバックグリッド."""
    cell_w = img_w // cols
    cell_h = img_h // rows
    grid: list[list[CellInfo]] = []
    for r in range(rows):
        row: list[CellInfo] = []
        for c in range(cols):
            x = c * cell_w
            y = r * cell_h
            row.append(CellInfo(x=x, y=y, w=cell_w, h=cell_h,
                                center_x=x + cell_w / 2,
                                center_y=y + cell_h / 2))
        grid.append(row)
    return grid


def _detect_tile_grid(
    arr: np.ndarray, expected_rows: int, expected_cols: int
) -> list[list[CellInfo]]:
    """タイル画像用のグリッド検出.

    明度プロファイルで行・列の境界を検出。
    void等の暗いタイルがあっても、最も多く列が検出された行の
    列位置を全行に適用して正確なグリッドを構築する。
    """
    h, w = arr.shape[:2]
    brightness = np.mean(arr[:, :, :3], axis=2)

    # 行検出: 水平方向の平均明度プロファイル
    h_proj = np.mean(brightness, axis=1)
    row_bands = _find_bright_bands(h_proj, threshold=60, min_size=50)

    if len(row_bands) != expected_rows:
        print(f"  Tile row detection: {len(row_bands)} rows (expected {expected_rows})")
        # フォールバック: 均等分割
        band_h = h // expected_rows
        row_bands = [(i * band_h, (i + 1) * band_h) for i in range(expected_rows)]

    # 列検出: 最もクリーンに検出できる行を使う
    best_cols: list[tuple[int, int]] = []
    for ys, ye in row_bands:
        row_bright = brightness[ys:ye, :]
        v_proj = np.mean(row_bright, axis=0)
        cols = _find_bright_bands(v_proj, threshold=55, min_size=30)
        if len(cols) == expected_cols:
            best_cols = cols
            break
        if len(cols) > len(best_cols):
            best_cols = cols

    if len(best_cols) != expected_cols:
        print(f"  Tile col detection: {len(best_cols)} cols (expected {expected_cols})")
        # 検出された列から間隔を推定して補完
        if best_cols:
            spacing = np.median([e - s for s, e in best_cols])
            first_x = best_cols[0][0]
            best_cols = [
                (int(first_x + i * (spacing + 20)), int(first_x + i * (spacing + 20) + spacing))
                for i in range(expected_cols)
            ]
        else:
            band_w = w // expected_cols
            best_cols = [(i * band_w, (i + 1) * band_w) for i in range(expected_cols)]

    # グリッド構築
    grid: list[list[CellInfo]] = []
    for ys, ye in row_bands:
        row: list[CellInfo] = []
        for xs, xe in best_cols:
            row.append(CellInfo(
                x=xs, y=ys, w=xe - xs, h=ye - ys,
                center_x=(xs + xe) / 2, center_y=(ys + ye) / 2,
            ))
        grid.append(row)

    return grid


def _find_bright_bands(
    projection: np.ndarray, threshold: float, min_size: int
) -> list[tuple[int, int]]:
    """明度プロファイルから明るい区間（コンテンツバンド）を検出."""
    active = projection > threshold
    bands: list[tuple[int, int]] = []
    in_band = False
    start = 0

    for i in range(len(active)):
        if active[i] and not in_band:
            start = i
            in_band = True
        elif not active[i] and in_band:
            if i - start >= min_size:
                bands.append((start, i))
            in_band = False
    if in_band and len(active) - start >= min_size:
        bands.append((start, len(active)))

    return bands


def process_tiles(
    source_path: Path,
    meta: dict,
    output_dir: Path,
    session,
) -> list[Path]:
    """tiles系画像を処理.

    タイルは全面描画のため、元画像からクロップ。
    明度プロファイルベースのグリッド検出で正確にセルを特定。
    """
    print(f"\n=== {source_path.name} (tiles) ===")

    img = Image.open(source_path).convert("RGBA")
    arr = np.array(img)
    print(f"  Size: {img.size}")

    tiles_meta = meta["tiles"]
    layout = meta["layout"]
    rows = layout["rows"]
    cols = layout["columns"]

    # タイル専用グリッド検出
    grid = _detect_tile_grid(arr, rows, cols)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_files: list[Path] = []

    tile_idx = 0
    for row_cells in grid:
        for cell in row_cells:
            if tile_idx >= len(tiles_meta):
                break

            tile = tiles_meta[tile_idx]
            filename = tile["outputFile"]
            out_path = output_dir / filename

            # セルを元画像からクロップ
            cell_img = img.crop((cell.x, cell.y, cell.x + cell.w, cell.y + cell.h))

            # 特殊タイル: void は黒ベタを直接生成
            if tile["name"] == "void":
                side = min(cell.w, cell.h)
                tile_img = Image.new("RGBA", (side, side), (0, 0, 0, 255))
            else:
                # rembgでコンテンツ領域を特定（チェッカーボード除去）
                rembg_result = remove(cell_img, session=session)
                alpha = np.array(rembg_result.split()[-1])

                # コンテンツ領域のbboxを取得
                rows_mask = np.any(alpha > 10, axis=1)
                cols_mask = np.any(alpha > 10, axis=0)

                if np.any(rows_mask) and np.any(cols_mask):
                    row_idx_arr = np.nonzero(rows_mask)[0]
                    col_idx_arr = np.nonzero(cols_mask)[0]
                    y1 = row_idx_arr[0]
                    y2 = row_idx_arr[-1] + 1
                    x1 = col_idx_arr[0]
                    x2 = col_idx_arr[-1] + 1
                    tile_img = cell_img.crop((x1, y1, x2, y2))
                else:
                    tile_img = cell_img

            tile_img.save(out_path)
            output_files.append(out_path)

            print(f"  {filename}: {tile_img.size[0]}x{tile_img.size[1]}")
            tile_idx += 1

    print(f"\n  Output: {len(output_files)} files -> {output_dir}")
    return output_files


def main() -> None:
    """メインエントリポイント."""
    source_dir = Path(__file__).parent.parent.parent / "from_creator" / "gemini"
    output_base = source_dir / "_extracted"

    targets = [
        ("samurai-01.png", "samurai-01-meta.json", "samurai"),
        ("samurai-02.png", "samurai-02-meta.json", "samurai"),
        ("samurai-03.png", "samurai-03-meta.json", "samurai"),
        ("samurai-04.png", "samurai-04-meta.json", "samurai"),
        ("tiles-01.png", "tiles-01-meta.json", "tiles"),
    ]

    filter_name = sys.argv[1] if len(sys.argv) > 1 else "all"

    # GPUセッション作成（全画像で共有）
    print("Initializing rembg GPU session...")
    session = _create_gpu_session()

    for source_name, meta_name, role in targets:
        if filter_name != "all" and filter_name not in source_name:
            continue

        source_path = source_dir / source_name
        meta_path = source_dir / meta_name

        if not source_path.exists():
            print(f"SKIP: {source_path} not found")
            continue
        if not meta_path.exists():
            print(f"SKIP: {meta_path} not found")
            continue

        meta = load_meta(meta_path)
        output_dir = output_base / source_path.stem

        if role == "samurai":
            process_samurai(source_path, meta, output_dir, session)
        elif role == "tiles":
            process_tiles(source_path, meta, output_dir, session)


if __name__ == "__main__":
    main()
