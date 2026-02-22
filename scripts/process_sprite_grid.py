"""
スプライトグリッド後処理スクリプト

Gemini生成のグリッド画像から各アニメーション状態のスプライトシートを生成する。

処理フロー:
  1. 赤線を検出してセル行境界を特定
  2. 各行ごとに独立して縦赤線を検出しフレーム列境界を特定
  3. 各フレームを切り出し → 背景除去（リサイズ前） → 80×80px letterboxリサイズ（アスペクト比保持）
  4. アニメーション状態ごとにスプライトシート（横並び）を生成
  5. 水平反転版も生成（左右両方向を作成）

使用方法:
  uv run python scripts/process_sprite_grid.py <グリッド画像> <出力ディレクトリ> --spec <キャラ仕様JSON>

例:
  uv run python scripts/process_sprite_grid.py \
    "C:/Users/ray/Downloads/Gemini_gama.png" \
    public/assets/sprites/gama \
    --spec scripts/specs/gama.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


# ── 定数 ──────────────────────────────────────────────────────────────────────

FRAME_SIZE = 80  # 出力フレームサイズ (px)
CROP_MARGIN = 8  # 赤線中心からのクロップマージン (px)

# 背景色の除去閾値 (R範囲, G範囲, B範囲)
BG_PRESETS: dict[str, tuple[tuple[int, int], tuple[int, int], tuple[int, int]]] = {
    "magenta": ((180, 255), (0, 60), (180, 255)),
    "cyan":    ((0, 60),   (180, 255), (180, 255)),
}


# ── ユーティリティ ────────────────────────────────────────────────────────────

def group_centers(indices: np.ndarray, gap: int = 10) -> list[int]:
    """連続したインデックス群をグループ化し、各グループの中心座標を返す。"""
    if len(indices) == 0:
        return []
    centers: list[int] = []
    start = int(indices[0])
    prev = int(indices[0])
    for raw in indices[1:]:
        i = int(raw)
        if i > prev + gap:
            centers.append((start + prev) // 2)
            start = i
        prev = i
    centers.append((start + prev) // 2)
    return centers


def red_mask(arr: np.ndarray) -> np.ndarray:
    """赤ピクセル（セパレーター色）のブールマスクを返す。"""
    return (arr[:, :, 0] > 200) & (arr[:, :, 1] < 30) & (arr[:, :, 2] < 50)


# ── 赤線検出 ─────────────────────────────────────────────────────────────────

def detect_row_centers(arr: np.ndarray) -> list[int]:
    """横赤線の中心Y座標リストを返す。"""
    w = arr.shape[1]
    row_red = red_mask(arr).sum(axis=1)
    row_idx = np.where(row_red > w * 0.1)[0]
    return group_centers(row_idx)


def detect_col_centers(arr: np.ndarray, y1: int, y2: int) -> list[int]:
    """指定行範囲内の縦赤線中心X座標リストを返す。"""
    col_red = red_mask(arr)[y1:y2, :].sum(axis=0)
    col_idx = np.where(col_red > (y2 - y1) * 0.3)[0]
    return group_centers(col_idx)


# ── 背景除去 ──────────────────────────────────────────────────────────────────

def remove_background(img: Image.Image, bg_color: str) -> Image.Image:
    """背景色（マゼンタ/シアン）と赤線セパレーターを透過にして返す。

    リサイズ前の元サイズで呼ぶこと（リサイズ後はアンチエイリアシングで
    赤が混合され除去できなくなる）。
    """
    rgba = img.convert("RGBA")
    arr = np.array(rgba, dtype=np.int32)

    # 背景色マスク
    (r_min, r_max), (g_min, g_max), (b_min, b_max) = BG_PRESETS[bg_color]
    bg = (
        (arr[:, :, 0] >= r_min) & (arr[:, :, 0] <= r_max)
        & (arr[:, :, 1] >= g_min) & (arr[:, :, 1] <= g_max)
        & (arr[:, :, 2] >= b_min) & (arr[:, :, 2] <= b_max)
    )

    # 赤線マスク（セパレーター残留ピクセル）
    # B閾値を130まで許容 → 赤線とマゼンタ背景の混合アンチエイリアシングピクセルも捕捉
    red = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 60) & (arr[:, :, 2] < 130)

    result = arr.copy()
    result[bg | red, 3] = 0
    return Image.fromarray(result.astype(np.uint8), "RGBA")


# ── フレーム切り出し ──────────────────────────────────────────────────────────

def mask_label_text(img: Image.Image, frac_w: float = 0.18, frac_h: float = 0.14) -> Image.Image:
    """フレームセル左上のラベルテキスト領域を透過にする。

    背景除去前に呼ぶ場合はラベル領域を背景色にする必要があるが、
    背景除去後に呼ぶ場合はアルファを0にすればよい。
    ここでは背景除去前の呼び出しを想定し、ラベル領域のピクセルを直接透過にする。
    """
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    mask_w = max(1, int(w * frac_w))
    mask_h = max(1, int(h * frac_h))
    arr[:mask_h, :mask_w, 3] = 0
    return Image.fromarray(arr, "RGBA")


def extract_frames(
    img: Image.Image,
    row_centers: list[int],
    states: list[dict],
    bg_color: str,
    label_cols: int = 1,
    do_mask_labels: bool = False,
) -> dict[str, list[Image.Image]]:
    """各行ごとに独立して縦赤線を検出し、指定フレーム数分だけ切り出す。

    処理順: 切り出し → 背景除去（元サイズ） → リサイズ
    """
    arr = np.array(img)

    # 各状態行の境界を取得
    # デフォルト: ラベル行（最初のギャップ）をスキップ
    frame_row_bounds = list(zip(row_centers[1:-1], row_centers[2:]))

    # 行が不足する場合のフォールバック
    if len(frame_row_bounds) < len(states):
        # ヘッダースキップなしで全ギャップを使う（画像ヘッダーがグリッド外にある場合）
        frame_row_bounds_no_skip = list(zip(row_centers[:-1], row_centers[1:]))
        if len(frame_row_bounds_no_skip) >= len(states):
            print("  (auto) header skip disabled - all row gaps used as data rows")
            frame_row_bounds = frame_row_bounds_no_skip
        elif len(row_centers) >= 2:
            # それでも不足する場合、画像下端を最終境界として追加
            img_h = arr.shape[0]
            frame_row_bounds.append((row_centers[-1], img_h))
            print(f"  (fallback) added bottom boundary: ({row_centers[-1]}, {img_h})")

    result: dict[str, list[Image.Image]] = {}

    for state_idx, state in enumerate(states):
        name: str = state["name"]
        n_frames: int = state["frames"]

        if state_idx >= len(frame_row_bounds):
            print(f"  WARNING: '{name}' の行が不足", file=sys.stderr)
            continue

        y_top = frame_row_bounds[state_idx][0] + CROP_MARGIN
        y_bot = frame_row_bounds[state_idx][1] - CROP_MARGIN

        # この行専用の縦赤線を検出
        col_centers = detect_col_centers(arr, y_top, y_bot)
        print(f"  [{name}] col_centers: {col_centers}")
        if len(col_centers) < 2:
            print(f"  WARNING: '{name}' の縦赤線が不足 ({col_centers})", file=sys.stderr)
            result[name] = []
            continue

        # ラベル列を除いたフレーム列境界
        skip = label_cols
        frame_col_bounds = list(zip(col_centers[skip:-1], col_centers[skip + 1:]))

        # フォールバック: 列が不足する場合、画像右端を最終境界として追加
        if len(frame_col_bounds) < n_frames and len(col_centers) >= 2:
            img_w = arr.shape[1]
            frame_col_bounds.append((col_centers[-1], img_w))
            print(f"    (fallback) added right boundary: ({col_centers[-1]}, {img_w})")

        frames: list[Image.Image] = []
        for f in range(n_frames):
            if f >= len(frame_col_bounds):
                print(f"  WARNING: '{name}' F{f+1} 列が不足", file=sys.stderr)
                break

            x_left = frame_col_bounds[f][0] + CROP_MARGIN
            x_right = frame_col_bounds[f][1] - CROP_MARGIN

            print(f"  {name} F{f+1}: ({x_left},{y_top})-({x_right},{y_bot}) [{x_right-x_left}x{y_bot-y_top}px]")

            cell = img.crop((x_left, y_top, x_right, y_bot))
            cell = remove_background(cell, bg_color)          # ← 元サイズで除去
            if do_mask_labels:
                cell = mask_label_text(cell)                  # ← ラベルテキスト除去
            cell = fit_to_frame(cell)                         # ← アスペクト比保持リサイズ
            frames.append(cell)

        result[name] = frames

    return result


# ── アスペクト比保持リサイズ ──────────────────────────────────────────────────

def fit_to_frame(img: Image.Image, size: int = FRAME_SIZE) -> Image.Image:
    """アスペクト比を保持しながら size×size のキャンバスに収める（letterbox）。

    セル幅とセル高さが異なる場合でも形状を歪めずに収める。
    余白は透過で埋める。
    """
    w, h = img.size
    if w == 0 or h == 0:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min(size / w, size / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


# ── フレーム間整合性チェック ──────────────────────────────────────────────────

def check_frame_consistency(
    frames: list[Image.Image],
    state_name: str,
    warn_threshold: float = 0.35,
) -> None:
    """フレーム間のシルエット IoU を計算し、差分が大きい組み合わせを警告する。

    IoU (Intersection over Union) = 重なり面積 / 合算面積
    差分 = 1 - IoU : 0.0=完全一致, 1.0=全く重ならない
    warn_threshold 超えで WARNING を出力。
    """
    if len(frames) < 2:
        return
    print(f"  [{state_name}] シルエット差分:")
    for i in range(len(frames) - 1):
        a = np.array(frames[i])[:, :, 3] > 0
        b = np.array(frames[i + 1])[:, :, 3] > 0
        union = int((a | b).sum())
        if union == 0:
            diff = 0.0
        else:
            iou = int((a & b).sum()) / union
            diff = 1.0 - iou
        flag = "!! WARNING diff large" if diff > warn_threshold else "ok"
        print(f"    F{i + 1}<->F{i + 2}: diff={diff:.2f} {flag}")


# ── スプライトシート生成 ──────────────────────────────────────────────────────

def make_sprite_sheet(frames: list[Image.Image]) -> Image.Image:
    """フレームを横並びに結合したスプライトシートを返す。"""
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE, 0))
    return sheet


# ── メイン ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Geminiグリッド画像からスプライトシートを生成")
    parser.add_argument("input", help="グリッド画像パス")
    parser.add_argument("output_dir", help="出力ディレクトリ")
    parser.add_argument("--spec", required=True, help="キャラ仕様JSONパス")
    parser.add_argument(
        "--bg", default="magenta", choices=list(BG_PRESETS.keys()),
        help="背景色プリセット (default: magenta)",
    )
    parser.add_argument(
        "--directions", default="right,left",
        help="生成方向 comma区切り (right=そのまま, left=水平反転, default: right,left)",
    )
    parser.add_argument(
        "--label-cols", type=int, default=1,
        help="ラベル列としてスキップする列数 (default: 1, ラベルが画像左端にある場合は 0)",
    )
    parser.add_argument(
        "--mask-labels", action="store_true",
        help="各フレームセル左上のラベルテキスト (F1, F2等) をマスク除去する",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(args.spec, encoding="utf-8") as f:
        spec: dict = json.load(f)
    states: list[dict] = spec["states"]
    directions = [d.strip() for d in args.directions.split(",")]

    print(f"読み込み: {input_path}")
    img = Image.open(input_path).convert("RGBA")
    arr = np.array(img)

    print("横赤線検出...")
    row_centers = detect_row_centers(arr)
    print(f"  {row_centers}")

    label_cols: int = args.label_cols
    do_mask_labels: bool = args.mask_labels
    print(f"フレーム切り出し... (label_cols={label_cols}, mask_labels={do_mask_labels})")
    frames_by_state = extract_frames(
        img, row_centers, states, args.bg,
        label_cols=label_cols, do_mask_labels=do_mask_labels,
    )

    print("\nフレーム整合性チェック...")
    for state in states:
        name = state["name"]
        frames = frames_by_state.get(name, [])
        if frames:
            check_frame_consistency(frames, name)

    for direction in directions:
        flip = direction == "left"
        print(f"\n--- {direction} {'(水平反転)' if flip else ''} ---")

        for state in states:
            name = state["name"]
            frames = frames_by_state.get(name, [])
            if not frames:
                print(f"  SKIP: {name}")
                continue

            # フレーム選択: select フィールドがあれば指定インデックスのみ使用
            select = state.get("select")
            if select is not None:
                selected: list[Image.Image] = []
                for idx in select:
                    if idx < len(frames):
                        selected.append(frames[idx])
                    else:
                        print(f"  WARNING: '{name}' select index {idx} out of range ({len(frames)} frames)", file=sys.stderr)
                frames = selected
                print(f"  [{name}] select={select} → {len(frames)}f")

            processed = [
                f.transpose(Image.FLIP_LEFT_RIGHT) if flip else f
                for f in frames
            ]
            sheet = make_sprite_sheet(processed)
            out_path = output_dir / f"{name}-{direction}.png"
            sheet.save(out_path, "PNG")
            print(f"  保存: {out_path} ({len(processed)}f, {sheet.size[0]}x{sheet.size[1]}px)")

    print("\n完了!")


if __name__ == "__main__":
    main()
