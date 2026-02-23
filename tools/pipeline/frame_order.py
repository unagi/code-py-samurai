"""フレーム順序決定ツール.

2つのモードで動作する:

■ Idle モード（デフォルト）:
  全フレーム間の NxN 距離行列を構築し、TSP 風の最適順序 + ping-pong サイクルを選定。

■ Ref モード（--ref 指定時）:
  参照フレーム（idle A 端点等）からの DT 距離で action フレームを昇順ソート。
  attack / damaged / death など、idle 基準で「近い順＝アクション開始」に並べる用途。

共通処理:
1. 全フレームを同サイズ正方形にパディング
2. 指定フレームを左右反転（R→L統一）
3. Gaussian blur + Canny → edge画像
4. Distance Transform（輪郭の"近さ"を滑らかに計測）
5. ECC (Euclidean) で位置合わせ（頭の傾きなど吸収）

実行例 (idle モード):
    cd tools && uv run python pipeline/frame_order.py \\
        ../from_creator/gemini/_cells/gama-01 \\
        --files r1c1.png r1c2.png r1c3.png r1c4.png r1c5.png \\
                r3c1.png r3c2.png r3c3.png r3c4.png r3c5.png \\
        --flip r3c1.png \\
        -o ../from_creator/gemini/_cells/gama-01/_idle_ordered \\
        --cycle-length 4

実行例 (ref モード — action フレームを idle A 基準でソート):
    cd tools && uv run python pipeline/frame_order.py \\
        ../from_creator/gemini/_cells/gama-01 \\
        --ref r1c4.png \\
        --files r2c1.png r2c2.png \\
        -o ../from_creator/gemini/_cells/gama-01/_attack_west
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


# ── Step 1-2: 正方形正規化 + 反転 ────────────────────────────────


def round_up_to_multiple(value: int, multiple: int) -> int:
    """値を指定倍数に切り上げ."""
    return ((value + multiple - 1) // multiple) * multiple


def load_and_normalize(
    files: list[Path],
    flip_set: set[str],
    *,
    target_size: int = 320,
) -> tuple[list[Image.Image], int]:
    """フレームを読み込み、target_size の正方形に縮小フィット + 反転.

    target_size は 80 の倍数を想定（320=4x, 160=2x 等、Retina対策）。
    全フレームを同一スケールで縮小し、正方形キャンバスに中央配置。
    """
    raw_images: list[Image.Image] = []
    max_dim = 0

    # Pass 1: 読み込み + 最大寸法を決定
    for f in files:
        img = Image.open(f).convert("RGBA")
        max_dim = max(max_dim, img.width, img.height)
        raw_images.append(img)

    # 全フレーム共通のスケール（最大フレームが target_size に収まる）
    scale = target_size / max_dim if max_dim > target_size else 1.0

    # Pass 2: 反転 → 縮小 → 正方形キャンバスに中央配置
    normalized: list[Image.Image] = []
    for img, f in zip(raw_images, files):
        if f.name in flip_set:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)

        if scale < 1.0:
            new_w = round(img.width * scale)
            new_h = round(img.height * scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
        off_x = (target_size - img.width) // 2
        off_y = (target_size - img.height) // 2
        canvas.alpha_composite(img, (off_x, off_y))
        normalized.append(canvas)

    return normalized, target_size


# ── Step 3-4: Edge + Distance Transform ──────────────────────────


def compute_edge_and_dt(
    img_rgba: Image.Image,
    *,
    blur_ksize: int = 3,
    canny_low: int = 50,
    canny_high: int = 150,
) -> tuple[np.ndarray, np.ndarray]:
    """エッジ検出 → Distance Transform."""
    gray = np.array(img_rgba.convert("L"), dtype=np.uint8)
    blurred = cv2.GaussianBlur(gray, (blur_ksize, blur_ksize), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)

    # DT: エッジからの距離（エッジ=0, 遠い=大）
    dt = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5)
    return edges, dt


# ── Step 5: ECC 位置合わせ ────────────────────────────────────────


def phase_correlation_shift(
    ref_dt: np.ndarray,
    target_dt: np.ndarray,
) -> tuple[float, float]:
    """Phase Correlation で平行移動量を一発推定（粗合わせ）."""
    ref_f = ref_dt.astype(np.float32)
    tgt_f = target_dt.astype(np.float32)
    shift, _response = cv2.phaseCorrelate(ref_f, tgt_f)
    return shift  # (dx, dy)


def ecc_align(
    ref_dt: np.ndarray,
    target_dt: np.ndarray,
    *,
    motion_type: int = cv2.MOTION_EUCLIDEAN,
    max_iter: int = 200,
    epsilon: float = 1e-6,
) -> tuple[np.ndarray, np.ndarray, float, tuple[float, float]]:
    """Phase Correlation（粗） → ECC（精）の2段アライメント.

    Returns:
        (aligned_dt, warp_matrix, correlation_coefficient, phase_shift)
    """
    # Stage 1: Phase Correlation で平行移動を粗推定
    dx, dy = phase_correlation_shift(ref_dt, target_dt)

    # Phase Correlation の結果を初期値にして ECC へ
    warp = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float32)

    ref_u8 = cv2.normalize(ref_dt, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    tgt_u8 = cv2.normalize(target_dt, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, max_iter, epsilon)

    try:
        # Stage 2: ECC で回転 + 微調整（精合わせ）
        cc, warp = cv2.findTransformECC(ref_u8, tgt_u8, warp, motion_type, criteria)
        aligned = cv2.warpAffine(
            target_dt,
            warp,
            (ref_dt.shape[1], ref_dt.shape[0]),
            flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP,
        )
        return aligned, warp, cc, (dx, dy)
    except cv2.error:
        # ECC 失敗時は Phase Correlation の結果だけ適用
        aligned = cv2.warpAffine(
            target_dt,
            warp,
            (ref_dt.shape[1], ref_dt.shape[0]),
            flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP,
        )
        return aligned, warp, 0.0, (dx, dy)


# ── Step 6: 距離行列 ─────────────────────────────────────────────


def compute_distance_matrix(dts: list[np.ndarray]) -> np.ndarray:
    """アライン済みDT画像から NxN 距離行列を構築."""
    n = len(dts)
    D = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            diff = np.abs(dts[i].astype(np.float64) - dts[j].astype(np.float64))
            d = float(np.mean(diff))
            D[i][j] = d
            D[j][i] = d
    return D


# ── Step 7: 順序決定 ─────────────────────────────────────────────


def find_farthest_pair(D: np.ndarray) -> tuple[int, int]:
    """最も遠い2フレームを返す."""
    n = D.shape[0]
    best_d = -1.0
    best = (0, 1)
    for i in range(n):
        for j in range(i + 1, n):
            if D[i][j] > best_d:
                best_d = D[i][j]
                best = (i, j)
    return best


def nearest_neighbor_path(D: np.ndarray, start: int, end: int) -> list[int]:
    """最近傍法で start→end のパスを構築."""
    n = D.shape[0]
    remaining = set(range(n)) - {start, end}
    path = [start]
    current = start

    while remaining:
        nearest = min(remaining, key=lambda x: D[current][x])
        path.append(nearest)
        remaining.remove(nearest)
        current = nearest

    path.append(end)
    return path


def path_length(D: np.ndarray, path: list[int]) -> float:
    """パスの総距離."""
    return sum(float(D[path[i]][path[i + 1]]) for i in range(len(path) - 1))


def two_opt_improve(D: np.ndarray, path: list[int]) -> list[int]:
    """2-opt でパスを改善."""
    best = list(path)
    best_len = path_length(D, best)
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best) - 1):
                candidate = best[:i] + best[i : j + 1][::-1] + best[j + 1 :]
                cand_len = path_length(D, candidate)
                if cand_len < best_len:
                    best = candidate
                    best_len = cand_len
                    improved = True

    return best


def order_frames(D: np.ndarray) -> list[int]:
    """距離行列からフレームの最適順序を決定."""
    a, c = find_farthest_pair(D)
    path = nearest_neighbor_path(D, a, c)
    path = two_opt_improve(D, path)
    return path


# ── Step 8: Ping-pong サイクル選定 ────────────────────────────────


def select_ping_pong(
    ordered: list[int],
    cycle_length: int,
) -> list[int]:
    """順序付きフレームからループ用キーフレームを選定.

    A→B1→C→B2→A→B1→C→B2→... のサイクルを構成:
    - A  = ordered[0] (端)
    - C  = ordered[-1] (最遠端)
    - B1 = 行き (A→C) の中間
    - B2 = 帰り (C→A) の中間

    出力順: [A, B1, C, B2] — そのままループ再生すれば滑らか。
    """
    n = len(ordered)
    if n <= cycle_length:
        return list(ordered)

    if cycle_length == 3:
        # 3フレーム: A→B→C→B→A... (ping-pong bounce)
        mid = round((n - 1) / 2)
        return [ordered[0], ordered[mid], ordered[-1]]

    if cycle_length == 4:
        # 4フレーム: A→B1→C→B2 (cyclic loop)
        b1_pos = round((n - 1) / 3)
        b2_pos = round(2 * (n - 1) / 3)
        return [ordered[0], ordered[b1_pos], ordered[-1], ordered[b2_pos]]

    # 一般: 等間隔で半分を行き、半分を帰りに配置
    half = cycle_length // 2
    outbound: list[int] = []
    for k in range(half):
        pos = round(k * (n - 1) / (half - 1)) if half > 1 else 0
        outbound.append(ordered[pos])
    inbound: list[int] = []
    for k in range(cycle_length - half):
        pos = round((n - 1) - k * (n - 1) / (cycle_length - half))
        idx = ordered[round(pos)]
        if idx not in outbound:
            inbound.append(idx)
    return outbound + inbound


# ── スプライトシート組立 ──────────────────────────────────────────


def assemble_spritesheet(
    images: list[Image.Image],
    *,
    frame_size: int = 320,
) -> Image.Image:
    """フレームを横並びに結合してスプライトシートを生成.

    ラベルなし・パディングなし。ゲームエンジンが直接読み込む形式。
    """
    n = len(images)
    sheet = Image.new("RGBA", (n * frame_size, frame_size), (0, 0, 0, 0))
    for i, img in enumerate(images):
        sheet.alpha_composite(img, (i * frame_size, 0))
    return sheet


# ── 可視化 ────────────────────────────────────────────────────────


def save_distance_matrix_image(
    D: np.ndarray,
    labels: list[str],
    output: Path,
) -> None:
    """距離行列をヒートマップ画像として保存."""
    n = D.shape[0]
    cell_size = 60
    header = 80
    size = header + n * cell_size

    img = Image.new("RGB", (size, size), (30, 30, 30))
    draw = ImageDraw.Draw(img)

    d_max = float(np.max(D)) if np.max(D) > 0 else 1.0

    for i in range(n):
        # Row/col labels
        draw.text((5, header + i * cell_size + 20), labels[i][:8], fill=(200, 200, 200))
        draw.text((header + i * cell_size + 5, 5), labels[i][:8], fill=(200, 200, 200))

        for j in range(n):
            x0 = header + j * cell_size
            y0 = header + i * cell_size
            val = D[i][j] / d_max
            r = int(255 * val)
            g = int(255 * (1 - val))
            draw.rectangle((x0, y0, x0 + cell_size - 2, y0 + cell_size - 2), fill=(r, g, 40))
            draw.text((x0 + 5, y0 + 20), f"{D[i][j]:.1f}", fill=(255, 255, 255))

    img.save(output, "PNG")


def save_contact_sheet(
    images: list[Image.Image],
    labels: list[str],
    output: Path,
    *,
    thumb_size: int = 160,
    cols: int = 5,
) -> None:
    """フレーム一覧のコンタクトシートを保存."""
    n = len(images)
    rows = (n + cols - 1) // cols
    pad = 8
    label_h = 28
    cell_h = thumb_size + label_h

    sheet_w = pad + cols * (thumb_size + pad)
    sheet_h = pad + rows * (cell_h + pad)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (30, 30, 30, 255))
    draw = ImageDraw.Draw(sheet)

    for idx, (img, label) in enumerate(zip(images, labels)):
        row = idx // cols
        col = idx % cols
        x = pad + col * (thumb_size + pad)
        y = pad + row * (cell_h + pad)

        thumb = img.copy()
        thumb.thumbnail((thumb_size, thumb_size), Image.LANCZOS)
        off_x = x + (thumb_size - thumb.width) // 2
        off_y = y + label_h + (thumb_size - thumb.height) // 2
        sheet.alpha_composite(thumb, (off_x, off_y))

        draw.text((x + 4, y + 4), label, fill=(220, 220, 220))

    sheet.save(output, "PNG")


# ── CLI ───────────────────────────────────────────────────────────


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="フレーム順序決定（idle: 距離行列+TSP, action: ref基準ソート）",
    )
    parser.add_argument("input_dir", type=Path, help="フレームが入ったディレクトリ")
    parser.add_argument(
        "--files",
        nargs="+",
        required=True,
        help="対象ファイル名（input_dir 内）。ref モード時は action フレームのみ",
    )
    parser.add_argument(
        "--flip",
        nargs="*",
        default=[],
        help="左右反転するファイル名",
    )
    parser.add_argument("-o", "--output", type=Path, required=True, help="出力ディレクトリ")
    parser.add_argument("--size", type=int, default=320, help="正規化サイズ（80の倍数, デフォルト320=4x）")

    # Ref モード（action フレーム用）
    parser.add_argument(
        "--ref",
        type=str,
        metavar="REF_FILE",
        help="参照フレーム（input_dir 内）。指定時は ref→各frame の DT距離で昇順ソート",
    )

    # Idle モード専用
    parser.add_argument("--cycle-length", type=int, default=4, help="ping-pong キーフレーム数（idle モード）")
    parser.add_argument(
        "--endpoints",
        nargs=2,
        metavar=("A", "C"),
        help="ping-pong 端点を手動指定（ファイル名 stem, 例: r1c1 r3c3）（idle モード）",
    )

    # 共通パラメータ
    parser.add_argument("--blur-ksize", type=int, default=3, help="Gaussian blur カーネルサイズ")
    parser.add_argument("--canny-low", type=int, default=50, help="Canny low threshold")
    parser.add_argument("--canny-high", type=int, default=150, help="Canny high threshold")
    return parser


def run_ref_mode(args: argparse.Namespace) -> None:
    """--ref モード: 参照フレームからの DT 距離で action フレームを昇順ソート."""
    out: Path = args.output
    out.mkdir(parents=True, exist_ok=True)

    # ── 参照フレーム検証 ──
    ref_path = args.input_dir / args.ref
    if not ref_path.exists():
        print(f"Error: ref {ref_path} not found", file=sys.stderr)
        sys.exit(1)

    # ── action フレーム読み込み ──
    files: list[Path] = []
    for name in args.files:
        p = args.input_dir / name
        if not p.exists():
            print(f"Error: {p} not found", file=sys.stderr)
            sys.exit(1)
        files.append(p)

    flip_set = set(args.flip)
    labels = [f.stem for f in files]
    n = len(files)
    ref_stem = Path(args.ref).stem

    print("Mode: ref (参照基準ソート)")
    print(f"Ref: {args.ref}")
    print(f"Action frames: {n}")
    print(f"Flip: {flip_set or 'none'}")

    # ── 正規化（ref + action を一括でスケール統一）──
    print("\n[1/4] Normalizing...")
    all_files = [ref_path] + files
    all_images, square_size = load_and_normalize(all_files, flip_set, target_size=args.size)

    ref_img = all_images[0]
    action_images = all_images[1:]

    norm_dir = out / "normalized"
    norm_dir.mkdir(exist_ok=True)
    ref_img.save(norm_dir / f"{ref_stem}_ref.png", "PNG")
    for img, label in zip(action_images, labels):
        img.save(norm_dir / f"{label}.png", "PNG")
    print(f"  Square size: {square_size}×{square_size}")

    # ── 参照の DT 算出 ──
    print("[2/4] Computing ref DT...")
    ref_edges, ref_dt = compute_edge_and_dt(
        ref_img,
        blur_ksize=args.blur_ksize,
        canny_low=args.canny_low,
        canny_high=args.canny_high,
    )
    print(f"  REF ({ref_stem}): edge_pixels={int(np.sum(ref_edges > 0))}")

    # ── 各 action フレーム: DT + ECC align + 距離算出 ──
    print("[3/4] Computing distances from ref...")
    distances: list[tuple[int, float, str]] = []
    for i, (img, label) in enumerate(zip(action_images, labels)):
        _, dt = compute_edge_and_dt(
            img,
            blur_ksize=args.blur_ksize,
            canny_low=args.canny_low,
            canny_high=args.canny_high,
        )
        aligned, _warp, cc, (pdx, pdy) = ecc_align(ref_dt, dt)
        diff = np.abs(ref_dt.astype(np.float64) - aligned.astype(np.float64))
        dist = float(np.mean(diff))
        distances.append((i, dist, label))
        print(f"  {label}: dist={dist:.4f}, cc={cc:.4f}, phase=({pdx:.1f},{pdy:.1f})")

    # ── 昇順ソート（idle に近い順 = アクション開始）──
    distances.sort(key=lambda x: x[1])
    sorted_indices = [d[0] for d in distances]
    sorted_labels = [d[2] for d in distances]
    sorted_dists = [d[1] for d in distances]

    print(f"\n  Sorted: {' → '.join(sorted_labels)}")
    for label, dist in zip(sorted_labels, sorted_dists):
        print(f"    {label}: {dist:.4f}")

    # ── 出力 ──
    print("\n[4/4] Saving outputs...")
    sorted_images = [action_images[i] for i in sorted_indices]

    # コンタクトシート（REF + ソート済み、目視確認用）
    contact_labels = [f"REF: {ref_stem}"] + [
        f"#{k + 1} {l} (d={d:.2f})"
        for k, (l, d) in enumerate(zip(sorted_labels, sorted_dists))
    ]
    save_contact_sheet(
        [ref_img] + sorted_images,
        contact_labels,
        out / "ordered_contact.png",
    )

    # スプライトシート（action フレームのみ、ラベルなし）
    sheet = assemble_spritesheet(sorted_images, frame_size=square_size)
    sheet.save(out / "spritesheet.png", "PNG")

    # ミラー版スプライトシート（左右対称キャラ: L↔R 変換用）
    mirrored_frames = [img.transpose(Image.FLIP_LEFT_RIGHT) for img in sorted_images]
    mirrored = assemble_spritesheet(mirrored_frames, frame_size=square_size)
    mirrored.save(out / "spritesheet_mirrored.png", "PNG")

    # JSON レポート
    report = {
        "mode": "ref",
        "ref_file": args.ref,
        "input_files": [f.name for f in files],
        "flip": list(flip_set),
        "square_size": square_size,
        "sorted_order": sorted_labels,
        "sorted_indices": sorted_indices,
        "distances_from_ref": {l: d for l, d in zip(sorted_labels, sorted_dists)},
        "spritesheet_size": f"{sheet.width}×{sheet.height}",
    }
    with open(out / "report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\nOutput: {out}")
    print(f"  ordered_contact.png      - REF + ソート済みフレーム（目視確認用）")
    print(f"  spritesheet.png          - スプライトシート ({n}f, {sheet.width}×{sheet.height})")
    print(f"  spritesheet_mirrored.png - 左右反転版")
    print(f"  report.json              - 距離データ")
    print(f"  normalized/              - 正規化済み個別フレーム")


def main() -> None:
    args = create_parser().parse_args()

    if args.ref:
        run_ref_mode(args)
        return

    # ── Idle モード ──
    out = args.output
    out.mkdir(parents=True, exist_ok=True)

    # ── Load files ──
    files: list[Path] = []
    for name in args.files:
        p = args.input_dir / name
        if not p.exists():
            print(f"Error: {p} not found", file=sys.stderr)
            sys.exit(1)
        files.append(p)

    flip_set = set(args.flip)
    labels = [f.stem for f in files]
    n = len(files)

    print(f"Frames: {n}")
    print(f"Flip: {flip_set or 'none'}")

    # ── Step 1-2: 正方形化 + 反転 ──
    print("\n[1/6] Normalizing to square + flipping...")
    images, square_size = load_and_normalize(files, flip_set, target_size=args.size)
    print(f"  Square size: {square_size}×{square_size}")

    # 正規化済み画像を保存
    norm_dir = out / "normalized"
    norm_dir.mkdir(exist_ok=True)
    for img, label in zip(images, labels):
        img.save(norm_dir / f"{label}.png", "PNG")

    # ── Step 3-4: Edge + DT ──
    print("[2/6] Computing edges + distance transforms...")
    edges_list: list[np.ndarray] = []
    dt_list: list[np.ndarray] = []
    for img, label in zip(images, labels):
        edges, dt = compute_edge_and_dt(
            img,
            blur_ksize=args.blur_ksize,
            canny_low=args.canny_low,
            canny_high=args.canny_high,
        )
        edges_list.append(edges)
        dt_list.append(dt)
        print(f"  {label}: edge_pixels={int(np.sum(edges > 0))}, dt_max={dt.max():.1f}")

    # ── Step 5: ECC 位置合わせ ──
    print("[3/6] ECC alignment (Euclidean)...")
    ref_idx = 0
    ref_dt = dt_list[ref_idx]
    aligned_dts: list[np.ndarray] = [ref_dt]

    for i in range(1, n):
        aligned, warp, cc, (pdx, pdy) = ecc_align(ref_dt, dt_list[i])
        aligned_dts.append(aligned)
        # warp の回転角度を抽出
        angle = float(np.degrees(np.arctan2(warp[1, 0], warp[0, 0])))
        tx, ty = float(warp[0, 2]), float(warp[1, 2])
        print(
            f"  {labels[i]}: phase=({pdx:.1f},{pdy:.1f}) → "
            f"ecc: cc={cc:.4f}, rot={angle:.2f}°, t=({tx:.1f},{ty:.1f})",
        )

    # ── Step 6: 距離行列 ──
    print("[4/6] Computing distance matrix...")
    D = compute_distance_matrix(aligned_dts)

    # 行列表示
    print("\n  Distance matrix:")
    header = "         " + " ".join(f"{l:>8s}" for l in labels)
    print(header)
    for i in range(n):
        row_str = f"  {labels[i]:>6s}  " + " ".join(f"{D[i][j]:8.2f}" for j in range(n))
        print(row_str)

    save_distance_matrix_image(D, labels, out / "distance_matrix.png")

    # ── Step 7: 順序決定 ──
    print("\n[5/6] Ordering frames...")
    if args.endpoints:
        # 端点を手動指定
        a_label, c_label = args.endpoints
        if a_label not in labels or c_label not in labels:
            avail = ", ".join(labels)
            print(f"Error: --endpoints must be from: {avail}", file=sys.stderr)
            sys.exit(1)
        a = labels.index(a_label)
        c = labels.index(c_label)
        print(f"  Manual endpoints: {labels[a]} <-> {labels[c]} (d={D[a][c]:.2f})")
    else:
        a, c = find_farthest_pair(D)
        print(f"  Farthest pair: {labels[a]} <-> {labels[c]} (d={D[a][c]:.2f})")

    path = nearest_neighbor_path(D, a, c)
    ordered = two_opt_improve(D, path)
    total_d = path_length(D, ordered)
    print(f"  Order: {' → '.join(labels[i] for i in ordered)}")
    print(f"  Total path length: {total_d:.2f}")

    # ── Step 8: Ping-pong 選定 ──
    print(f"\n[6/6] Selecting ping-pong cycle (length={args.cycle_length})...")
    cycle = select_ping_pong(ordered, args.cycle_length)
    cycle_str = " → ".join(labels[i] for i in cycle)
    print(f"  Cycle: {cycle_str} → (loop)")
    print(f"  Loop: ...{cycle_str} → {cycle_str} → ...")

    # ── 出力 ──
    # 順序付きコンタクトシート
    ordered_labels = [f"#{k+1} {labels[i]}" for k, i in enumerate(ordered)]
    save_contact_sheet(
        [images[i] for i in ordered],
        ordered_labels,
        out / "ordered_contact.png",
    )

    # サイクル用コンタクトシート (A→B1→C→B2 順)
    cycle_roles = {0: "A", 2: "C"} if len(cycle) == 4 else {}
    cycle_labels_list = []
    for k, i in enumerate(cycle):
        if len(cycle) == 4:
            role = {0: "A(start)", 1: "B1(out)", 2: "C(peak)", 3: "B2(ret)"}[k]
        elif len(cycle) == 3:
            role = {0: "A", 1: "B", 2: "C"}[k]
        else:
            role = f"#{k+1}"
        cycle_labels_list.append(f"{role}: {labels[i]}")
    save_contact_sheet(
        [images[i] for i in cycle],
        cycle_labels_list,
        out / "cycle_contact.png",
    )

    # JSON レポート
    report = {
        "input_files": [f.name for f in files],
        "flip": list(flip_set),
        "square_size": square_size,
        "distance_matrix": D.tolist(),
        "labels": labels,
        "farthest_pair": [labels[a], labels[c], float(D[a][c])],
        "ordered": [labels[i] for i in ordered],
        "ordered_indices": ordered,
        "total_path_length": total_d,
        "cycle": [labels[i] for i in cycle],
        "cycle_indices": cycle,
    }
    with open(out / "report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\nOutput: {out}")
    print(f"  distance_matrix.png  - 距離行列ヒートマップ")
    print(f"  ordered_contact.png  - 全フレーム順序")
    print(f"  cycle_contact.png    - ping-pong サイクル")
    print(f"  report.json          - 全数値データ")
    print(f"  normalized/          - 正規化済み個別フレーム")


if __name__ == "__main__":
    main()
