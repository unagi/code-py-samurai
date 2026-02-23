"""Phase 7 (semantic): AnimateDiff + ControlNet で単一フレームからモーション生成.

設計方針:
- 呼び出し側はセマンティック intent を指定する
- 回転/拡縮/平行移動など幾何学変形でモーションを作らない
- モーション専用モデル (AnimateDiff) でフレーム列を生成する
- 品質優先: 読み込み失敗時のランタイムフォールバックは既定で禁止

実行例:
    python tools/pipeline/phase7_semantic_motion.py \
      public/assets/sprites/samurai-cat/idle-east-frames/frame_01.png \
      -o from_creator/gemini/_semantic_motion/idle-east-frame01 \
      --intent idle_sway_small \
      --base-model stable-diffusion-v1-5/stable-diffusion-v1-5 \
      --motion-adapter guoyww/animatediff-motion-adapter-v1-5-2 \
      --controlnet-model from_creator/_models/control_v11p_sd15_lineart \
      --conditioning-mode lineart_anime \
      --num-frames 8 \
      --seed 5201 \
      --device cuda
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from controlnet_aux.processor import Processor
from diffusers import (
    AnimateDiffVideoToVideoControlNetPipeline,
    ControlNetModel,
    MotionAdapter,
)
from PIL import Image, ImageDraw


@dataclass(frozen=True)
class IntentConfig:
    """セマンティック intent の推論パラメータ."""

    description: str
    prompt_suffix: str
    negative_suffix: str
    steps: int
    guidance_scale: float
    strength: float
    control_scale: float
    target_diff_min: float
    target_diff_max: float
    min_edge_iou: float
    min_sharp_ratio: float


INTENTS: dict[str, IntentConfig] = {
    "idle_sway_small": IntentConfig(
        description="上半身の微小な重心移動を伴う idle ゆらぎ",
        prompt_suffix=(
            "same character, subtle idle sway, tiny torso shift, stable limbs, "
            "preserve lineart and flat shading, no deformation"
        ),
        negative_suffix=(
            "warped body, twisted limbs, melted details, blurry lineart, "
            "extra arms, broken anatomy"
        ),
        steps=20,
        guidance_scale=3.8,
        strength=0.34,
        control_scale=1.1,
        target_diff_min=5.0,
        target_diff_max=20.0,
        min_edge_iou=0.48,
        min_sharp_ratio=0.88,
    ),
    "tail_sway_small": IntentConfig(
        description="しっぽ先端の小さな左右スイング（胴体は安定）",
        prompt_suffix=(
            "same character, subtle tail sway, tiny tail tip swish, "
            "body and head stable, preserve sharp lineart and flat colors, no deformation"
        ),
        negative_suffix=(
            "duplicated tail, broken tail silhouette, body sway, warped anatomy, "
            "melted details, blurry lineart"
        ),
        steps=22,
        guidance_scale=3.9,
        strength=0.32,
        control_scale=1.15,
        target_diff_min=4.0,
        target_diff_max=14.0,
        min_edge_iou=0.52,
        min_sharp_ratio=0.90,
    ),
    "tail_sway_large": IntentConfig(
        description="しっぽを明確に振る（胴体・頭部はできるだけ安定）",
        prompt_suffix=(
            "same character, pronounced tail swing, tail bends clearly to one side, "
            "noticeable tail motion, body and head mostly stable, preserve lineart and flat colors"
        ),
        negative_suffix=(
            "whole body sway, duplicated tail, broken tail silhouette, warped anatomy, "
            "melted details, blurry lineart, deformed face"
        ),
        steps=26,
        guidance_scale=3.3,
        strength=0.60,
        control_scale=0.75,
        target_diff_min=8.0,
        target_diff_max=24.0,
        min_edge_iou=0.42,
        min_sharp_ratio=0.84,
    ),
    "idle_breath_small": IntentConfig(
        description="胸郭付近のごく小さな呼吸モーション",
        prompt_suffix=(
            "same character, subtle breathing motion, tiny chest expansion, "
            "stable silhouette, preserve lineart and flat colors"
        ),
        negative_suffix=(
            "shape collapse, over-smoothed texture, extra limbs, blurry edges, "
            "anatomy errors"
        ),
        steps=20,
        guidance_scale=3.6,
        strength=0.30,
        control_scale=1.15,
        target_diff_min=6.0,
        target_diff_max=16.0,
        min_edge_iou=0.50,
        min_sharp_ratio=0.90,
    ),
    "raise_arm_small": IntentConfig(
        description="腕をわずかに持ち上げる動作（破綻禁止）",
        prompt_suffix=(
            "same character, gently raises one arm slightly, natural pose transition, "
            "stable anatomy, preserve sharp lineart and flat colors"
        ),
        negative_suffix=(
            "deformed arms, dislocated joints, extra fingers, blur, melted face, "
            "proportion collapse"
        ),
        steps=24,
        guidance_scale=4.0,
        strength=0.38,
        control_scale=1.05,
        target_diff_min=10.0,
        target_diff_max=24.0,
        min_edge_iou=0.46,
        min_sharp_ratio=0.86,
    ),
}


@dataclass(frozen=True)
class FrameScore:
    """各フレームの定量評価."""

    frame_file: str
    mean_diff: float
    fg_mean_diff: float
    region_diffs: dict[str, float]
    focus_ratio: float | None
    edge_iou: float
    sharpness: float
    sharpness_ratio: float
    accepted: bool
    score: float


DEFAULT_BASE_MODEL = "stable-diffusion-v1-5/stable-diffusion-v1-5"
DEFAULT_MOTION_ADAPTER = "guoyww/animatediff-motion-adapter-v1-5-2"
DEFAULT_CONTROLNET = "lllyasviel/control_v11p_sd15_lineart"
DEFAULT_UPSCAYL_BIN = r"C:\Program Files\Upscayl\resources\bin\upscayl-bin.exe"
DEFAULT_UPSCAYL_MODEL_DIR = r"C:\Program Files\Upscayl\resources\models"
DEFAULT_UPSCAYL_MODEL_NAME = "upscayl-standard-4x"


def parse_rgb_triplet(raw: str) -> tuple[int, int, int]:
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("bg-color は R,G,B 形式で指定してください")
    try:
        rgb = tuple(int(v) for v in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("bg-color は整数で指定してください") from exc
    if any(v < 0 or v > 255 for v in rgb):
        raise argparse.ArgumentTypeError("bg-color は 0-255 の範囲で指定してください")
    return rgb  # type: ignore[return-value]


def resolve_device(raw: str) -> str:
    if raw in ("cpu", "cuda"):
        if raw == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA が指定されましたが利用できません")
        return raw
    return "cuda" if torch.cuda.is_available() else "cpu"


def resolve_single_file_checkpoint(model_spec: str) -> str | None:
    """base model が single-file 指定なら checkpoint パスを返す."""
    p = Path(model_spec)
    if p.is_file() and p.suffix.lower() in {".safetensors", ".ckpt"}:
        return str(p)
    if not p.is_dir():
        return None
    if (p / "model_index.json").exists():
        return None
    ckpts = sorted(list(p.glob("*.safetensors")) + list(p.glob("*.ckpt")))
    if not ckpts:
        return None

    names = [c.name.lower() for c in ckpts]
    for key in ("fix_fp16", "fp16", "pruned"):
        for idx, name in enumerate(names):
            if key in name:
                return str(ckpts[idx])
    return str(ckpts[0])


def fit_rgba_to_square(src_rgba: Image.Image, size: int) -> Image.Image:
    """RGBA画像をアスペクト比維持で正方形キャンバスへ収める."""
    src_rgba = src_rgba.convert("RGBA")
    src_w, src_h = src_rgba.size
    if src_w <= 0 or src_h <= 0:
        raise RuntimeError("入力画像サイズが不正です")

    scale = min(size / src_w, size / src_h)
    dst_w = max(1, int(round(src_w * scale)))
    dst_h = max(1, int(round(src_h * scale)))
    resized = src_rgba.resize((dst_w, dst_h), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    off_x = (size - dst_w) // 2
    off_y = (size - dst_h) // 2
    canvas.alpha_composite(resized, (off_x, off_y))
    return canvas


def load_source_rgb(path: Path, size: int, bg_color: tuple[int, int, int]) -> Image.Image:
    """入力PNGをRGBへ変換（RGBAの場合は背景合成）."""
    src = Image.open(path)
    if src.mode != "RGBA":
        src_rgba = src.convert("RGBA")
    else:
        src_rgba = src
    src_rgba = fit_rgba_to_square(src_rgba, size)
    bg = Image.new("RGB", src_rgba.size, bg_color)
    bg.paste(src_rgba, mask=src_rgba.split()[-1])
    return bg


def load_foreground_mask(path: Path, size: int, alpha_threshold: int) -> np.ndarray:
    """入力PNGのalphaから前景マスクを作成."""
    src_rgba = fit_rgba_to_square(Image.open(path).convert("RGBA"), size)
    alpha = np.array(src_rgba.split()[-1], dtype=np.uint8)
    mask = alpha > alpha_threshold
    if not np.any(mask):
        return np.ones_like(alpha, dtype=bool)
    return mask


def make_canny(img: Image.Image, low: int, high: int) -> Image.Image:
    arr = np.array(img.convert("L"), dtype=np.uint8)
    edges = cv2.Canny(arr, low, high)
    rgb = np.stack([edges, edges, edges], axis=2)
    return Image.fromarray(rgb, mode="RGB")


def make_condition_frame(
    src_rgb: Image.Image,
    *,
    mode: str,
    canny_low: int,
    canny_high: int,
) -> Image.Image:
    if mode == "canny":
        return make_canny(src_rgb, canny_low, canny_high)

    processor = Processor(mode)
    out = processor(src_rgb, to_pil=True)
    if isinstance(out, list):
        if not out:
            raise RuntimeError(f"Processor({mode}) の出力が空です")
        out_img = out[0]
    else:
        out_img = out

    if isinstance(out_img, Image.Image):
        return out_img.convert("RGB").resize(src_rgb.size, Image.Resampling.BICUBIC)
    if isinstance(out_img, np.ndarray):
        return Image.fromarray(out_img.astype(np.uint8)).convert("RGB").resize(
            src_rgb.size, Image.Resampling.BICUBIC
        )
    raise RuntimeError(f"Processor({mode}) の出力型が未対応です: {type(out_img)}")


def compute_edge_iou(a: np.ndarray, b: np.ndarray, *, low: int, high: int) -> float:
    a_gray = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    b_gray = cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
    a_e = cv2.Canny(a_gray, low, high) > 0
    b_e = cv2.Canny(b_gray, low, high) > 0
    union = np.logical_or(a_e, b_e).sum()
    if union == 0:
        return 1.0
    inter = np.logical_and(a_e, b_e).sum()
    return float(inter / union)


def laplacian_var(img_rgb: np.ndarray) -> float:
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def parse_motion_quadrants(raw: str) -> set[str]:
    """局所モーション評価用の象限指定を解析."""
    if raw.strip() == "":
        return set()
    allowed = {"tl", "tr", "bl", "br"}
    items = {x.strip().lower() for x in raw.split(",") if x.strip()}
    invalid = sorted(items - allowed)
    if invalid:
        joined = ",".join(invalid)
        raise argparse.ArgumentTypeError(
            f"motion-quadrants に不正な値があります: {joined} (許容: tl,tr,bl,br)"
        )
    return items


def parse_resample_filter(raw: str) -> Image.Resampling:
    key = raw.strip().lower()
    mapping = {
        "nearest": Image.Resampling.NEAREST,
        "bilinear": Image.Resampling.BILINEAR,
        "bicubic": Image.Resampling.BICUBIC,
        "lanczos": Image.Resampling.LANCZOS,
    }
    if key not in mapping:
        raise argparse.ArgumentTypeError(
            "post-downscale-filter は nearest|bilinear|bicubic|lanczos で指定してください"
        )
    return mapping[key]


def parse_grid_size(raw: str) -> tuple[int, int]:
    """motion-grid 文字列 (例: 2x2) を解析."""
    text = raw.strip().lower().replace(" ", "")
    m = re.match(r"^(\d+)x(\d+)$", text)
    if m is None:
        raise argparse.ArgumentTypeError("motion-grid は NxM 形式で指定してください (例: 2x2)")
    rows = int(m.group(1))
    cols = int(m.group(2))
    if rows < 1 or cols < 1 or rows > 8 or cols > 8:
        raise argparse.ArgumentTypeError("motion-grid は 1x1 から 8x8 の範囲で指定してください")
    return rows, cols


def parse_focus_cells(raw: str) -> set[str]:
    """motion-focus-cells を解析。例: r2c1,r2c2"""
    if raw.strip() == "":
        return set()
    out: set[str] = set()
    for part in raw.split(","):
        token = part.strip().lower()
        m = re.match(r"^r(\d+)c(\d+)$", token)
        if m is None:
            raise argparse.ArgumentTypeError(
                "motion-focus-cells は r<row>c<col> のCSV形式で指定してください (例: r2c1,r2c2)"
            )
        out.add(f"r{int(m.group(1))}c{int(m.group(2))}")
    return out


def validate_focus_cells(cells: set[str], rows: int, cols: int) -> set[str]:
    """グリッド範囲外セルを検証."""
    valid: set[str] = set()
    for token in cells:
        m = re.match(r"^r(\d+)c(\d+)$", token)
        if m is None:
            continue
        r = int(m.group(1))
        c = int(m.group(2))
        if 1 <= r <= rows and 1 <= c <= cols:
            valid.add(token)
            continue
        raise argparse.ArgumentTypeError(
            f"motion-focus-cells の範囲外セル: {token} (grid={rows}x{cols})"
        )
    return valid


def masked_mean(diff_map: np.ndarray, mask: np.ndarray) -> float:
    sel = diff_map[mask]
    if sel.size == 0:
        return float(np.mean(diff_map))
    return float(np.mean(sel))


def compute_grid_diffs(
    diff_map: np.ndarray,
    fg_mask: np.ndarray,
    *,
    rows: int,
    cols: int,
) -> dict[str, float]:
    h, w = diff_map.shape
    out: dict[str, float] = {}
    for r in range(rows):
        y0 = (r * h) // rows
        y1 = ((r + 1) * h) // rows
        for c in range(cols):
            x0 = (c * w) // cols
            x1 = ((c + 1) * w) // cols
            key = f"r{r + 1}c{c + 1}"
            ys = slice(y0, y1)
            xs = slice(x0, x1)
            out[key] = masked_mean(diff_map[ys, xs], fg_mask[ys, xs])
    return out


def compute_focus_ratio(region_diffs: dict[str, float], focus_cells: set[str]) -> float | None:
    if not focus_cells:
        return None
    total = sum(region_diffs.values())
    if total <= 1e-6:
        return 0.0
    focus = sum(v for k, v in region_diffs.items() if k in focus_cells)
    return float(focus / total)


def analyze_temporal_wave(
    values: list[float],
    *,
    peak_window: int,
    min_step_ratio: float,
    min_peak_gap: float,
) -> dict[str, float | int | bool]:
    """差分系列が「増加して減少する」揺らぎ形状かを評価."""
    n = len(values)
    if n == 0:
        return {
            "peak_index": -1,
            "center_index": 0.0,
            "near_center": False,
            "left_increase_ratio": 0.0,
            "right_decrease_ratio": 0.0,
            "peak_gap_vs_ends": 0.0,
            "triangle_l1": 1.0,
            "passed": False,
        }

    arr = np.array(values, dtype=np.float32)
    peak_idx = int(np.argmax(arr))
    center = (n - 1) / 2.0
    near_center = abs(peak_idx - center) <= max(0, peak_window)

    left = arr[: peak_idx + 1]
    right = arr[peak_idx:]
    left_d = np.diff(left)
    right_d = np.diff(right)

    left_increase_ratio = float(np.mean(left_d >= 0.0)) if left_d.size > 0 else 1.0
    right_decrease_ratio = float(np.mean(right_d <= 0.0)) if right_d.size > 0 else 1.0

    end_mean = float((arr[0] + arr[-1]) / 2.0)
    peak_gap = float(arr[peak_idx] - end_mean)

    # 理想的な山形(0..1..0)との差分。小さいほど山形に近い。
    min_v = float(np.min(arr))
    max_v = float(np.max(arr))
    if max_v - min_v <= 1e-6:
        triangle_l1 = 1.0
    else:
        norm = (arr - min_v) / (max_v - min_v)
        denom = max(center, n - 1 - center, 1e-6)
        ideal = np.array([1.0 - (abs(i - center) / denom) for i in range(n)], dtype=np.float32)
        triangle_l1 = float(np.mean(np.abs(norm - ideal)))

    passed = (
        near_center
        and left_increase_ratio >= min_step_ratio
        and right_decrease_ratio >= min_step_ratio
        and peak_gap >= min_peak_gap
    )
    return {
        "peak_index": peak_idx,
        "center_index": round(center, 3),
        "near_center": bool(near_center),
        "left_increase_ratio": round(left_increase_ratio, 4),
        "right_decrease_ratio": round(right_decrease_ratio, 4),
        "peak_gap_vs_ends": round(peak_gap, 4),
        "triangle_l1": round(triangle_l1, 4),
        "passed": bool(passed),
    }


def ensure_upscayl_ready(bin_path: Path, model_dir: Path) -> None:
    if not bin_path.exists():
        raise RuntimeError(f"upscayl-bin が見つかりません: {bin_path}")
    if not model_dir.exists():
        raise RuntimeError(f"Upscayl model dir が見つかりません: {model_dir}")


def run_upscayl_once(
    *,
    bin_path: Path,
    model_dir: Path,
    model_name: str,
    input_path: Path,
    output_path: Path,
    scale: int,
    gpu_id: str,
    tile_size: int,
    verbose: bool,
) -> None:
    cmd = [
        str(bin_path),
        "-i",
        str(input_path),
        "-o",
        str(output_path),
        "-m",
        str(model_dir),
        "-n",
        model_name,
        "-s",
        str(scale),
        "-f",
        "png",
    ]
    if gpu_id != "auto":
        cmd.extend(["-g", gpu_id])
    if tile_size >= 0:
        cmd.extend(["-t", str(tile_size)])
    if verbose:
        cmd.append("-v")

    proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        msg = proc.stderr.strip() or proc.stdout.strip() or f"exit={proc.returncode}"
        raise RuntimeError(f"upscayl 実行失敗: {msg}")


def postprocess_selected_with_upscayl(
    *,
    selected_path: Path,
    work_dir: Path,
    render_size: int,
    bin_path: Path,
    model_dir: Path,
    model_name: str,
    passes: int,
    scale_per_pass: int,
    downscale_filter: Image.Resampling,
    keep_raw_selected: bool,
    keep_workdir: bool,
    gpu_id: str,
    tile_size: int,
    verbose: bool,
) -> dict[str, Any]:
    work_dir.mkdir(parents=True, exist_ok=True)
    stem = selected_path.stem
    raw_backup = selected_path.with_name(f"{stem}_raw.png")
    if keep_raw_selected:
        shutil.copy2(selected_path, raw_backup)

    current = work_dir / f"{stem}_pass0.png"
    shutil.copy2(selected_path, current)
    current_size = Image.open(current).size

    sizes: list[dict[str, int]] = [{"w": current_size[0], "h": current_size[1]}]
    for p in range(1, passes + 1):
        nxt = work_dir / f"{stem}_pass{p}.png"
        run_upscayl_once(
            bin_path=bin_path,
            model_dir=model_dir,
            model_name=model_name,
            input_path=current,
            output_path=nxt,
            scale=scale_per_pass,
            gpu_id=gpu_id,
            tile_size=tile_size,
            verbose=verbose,
        )
        current = nxt
        p_size = Image.open(current).size
        sizes.append({"w": p_size[0], "h": p_size[1]})

    with Image.open(current) as upscaled_src:
        upscaled = upscaled_src.convert("RGB")
        final = upscaled.resize((render_size, render_size), downscale_filter)
        final.save(selected_path, "PNG")

    if not keep_workdir:
        shutil.rmtree(work_dir, ignore_errors=True)

    return {
        "selected_file": selected_path.name,
        "passes": passes,
        "scale_per_pass": scale_per_pass,
        "model_name": model_name,
        "sizes": sizes,
        "raw_backup": raw_backup.name if keep_raw_selected else None,
        "work_dir": str(work_dir) if keep_workdir else None,
    }


def score_frame(
    frame: Image.Image,
    *,
    frame_file: str,
    src_arr: np.ndarray,
    fg_mask: np.ndarray,
    src_sharp: float,
    intent: IntentConfig,
    motion_grid: tuple[int, int],
    focus_cells: set[str],
    focus_ratio_min: float,
    canny_low: int,
    canny_high: int,
) -> FrameScore:
    h, w = src_arr.shape[0], src_arr.shape[1]
    norm = frame.convert("RGB").resize((w, h), Image.Resampling.NEAREST)
    arr = np.array(norm, dtype=np.float32)
    diff_map = np.mean(np.abs(arr - src_arr), axis=2)
    diff = float(np.mean(diff_map))
    fg_diff = masked_mean(diff_map, fg_mask)
    region_diffs = compute_grid_diffs(diff_map, fg_mask, rows=motion_grid[0], cols=motion_grid[1])
    focus_ratio = compute_focus_ratio(region_diffs, focus_cells)
    edge = compute_edge_iou(arr.astype(np.uint8), src_arr.astype(np.uint8), low=canny_low, high=canny_high)
    sharp = laplacian_var(arr.astype(np.uint8))
    sharp_ratio = float(sharp / src_sharp) if src_sharp > 1e-6 else 1.0

    focus_ok = True if focus_ratio is None else (focus_ratio >= focus_ratio_min)
    accepted = (
        intent.target_diff_min <= fg_diff <= intent.target_diff_max
        and edge >= intent.min_edge_iou
        and sharp_ratio >= intent.min_sharp_ratio
        and focus_ok
    )

    # 主指標は fg差分レンジ。edge は破綻検知寄りの下限として扱う。
    target_mid = (intent.target_diff_min + intent.target_diff_max) / 2.0
    target_span = max(1.0, intent.target_diff_max - intent.target_diff_min)
    diff_penalty = abs(fg_diff - target_mid) / target_span
    edge_penalty = max(0.0, intent.min_edge_iou - edge)
    sharp_penalty = max(0.0, intent.min_sharp_ratio - sharp_ratio)
    focus_bonus = 0.0 if focus_ratio is None else max(0.0, focus_ratio - focus_ratio_min)
    score = 1.0 - diff_penalty - (edge_penalty * 1.5) - (sharp_penalty * 2.0) + (focus_bonus * 0.8)

    return FrameScore(
        frame_file=frame_file,
        mean_diff=round(diff, 3),
        fg_mean_diff=round(fg_diff, 3),
        region_diffs={k: round(v, 3) for k, v in region_diffs.items()},
        focus_ratio=None if focus_ratio is None else round(focus_ratio, 4),
        edge_iou=round(edge, 4),
        sharpness=round(sharp, 3),
        sharpness_ratio=round(sharp_ratio, 4),
        accepted=accepted,
        score=round(score, 4),
    )


def save_contact_sheet(
    *,
    source_rgb: Image.Image,
    condition_rgb: Image.Image,
    frames: list[tuple[Image.Image, FrameScore]],
    output: Path,
) -> None:
    cards: list[tuple[str, Image.Image, bool | None]] = [
        ("source", source_rgb, None),
        ("conditioning", condition_rgb, None),
    ]
    for idx, (img, score) in enumerate(frames, start=1):
        focus_text = "-" if score.focus_ratio is None else f"{score.focus_ratio:.2f}"
        label = (
            f"{idx:02d} {'PASS' if score.accepted else 'FAIL'} "
            f"d={score.mean_diff:.1f} fg={score.fg_mean_diff:.1f} "
            f"iou={score.edge_iou:.2f} "
            f"sharp={score.sharpness_ratio:.2f} "
            f"focus={focus_text}"
        )
        cards.append((label, img, score.accepted))

    cols = 4
    rows = math.ceil(len(cards) / cols)
    w, h = source_rgb.size
    pad = 8
    label_h = 40
    cell_h = h + label_h

    sheet_w = pad + cols * (w + pad)
    sheet_h = pad + rows * (cell_h + pad)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)

    for i, (label, img, verdict) in enumerate(cards):
        row = i // cols
        col = i % cols
        x = pad + col * (w + pad)
        y = pad + row * (cell_h + pad)
        if verdict is True:
            border = (110, 220, 110)
        elif verdict is False:
            border = (240, 120, 120)
        else:
            border = (180, 180, 180)

        draw.rectangle((x, y, x + w, y + cell_h), outline=border, width=2)
        draw.text((x + 4, y + 4), label, fill=border)
        sheet.paste(img.resize((w, h), Image.Resampling.NEAREST), (x, y + label_h))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "PNG")


def extract_frames(result: Any) -> list[Image.Image]:
    """pipeline 出力からフレーム配列を取り出す."""
    if hasattr(result, "frames"):
        frames = result.frames
    elif isinstance(result, tuple) and len(result) > 0:
        frames = result[0]
    else:
        raise RuntimeError("AnimateDiff の出力形式を解釈できません")

    if isinstance(frames, list) and frames and isinstance(frames[0], list):
        return [f.convert("RGB") for f in frames[0]]
    if isinstance(frames, list):
        return [f.convert("RGB") for f in frames]
    raise RuntimeError("フレーム配列の形式が不正です")


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Phase 7 semantic: AnimateDiff + ControlNet で単フレーム派生を生成",
    )
    parser.add_argument("input", type=Path, help="元フレーム PNG")
    parser.add_argument("-o", "--output", type=Path, required=True, help="出力ディレクトリ")

    parser.add_argument("--intent", choices=sorted(INTENTS.keys()), default="idle_sway_small")
    parser.add_argument("--base-model", default=DEFAULT_BASE_MODEL)
    parser.add_argument("--motion-adapter", default=DEFAULT_MOTION_ADAPTER)
    parser.add_argument("--controlnet-model", default=DEFAULT_CONTROLNET)
    parser.add_argument(
        "--conditioning-mode",
        choices=("lineart_anime", "openpose", "openpose_full", "dwpose", "canny"),
        default="lineart_anime",
        help="ControlNet へ渡す条件画像の生成モード",
    )

    parser.add_argument(
        "--prompt-prefix",
        default=(
            "pixel art sprite, same character, same costume, same palette, "
            "clean silhouette, stable anatomy"
        ),
    )
    parser.add_argument(
        "--negative-prompt",
        default=(
            "deformed, extra limbs, blurry, smeared, text, watermark, "
            "background scene, realistic photo"
        ),
    )

    parser.add_argument("--num-frames", type=int, default=8)
    parser.add_argument("--select-count", type=int, default=4)
    parser.add_argument("--seed", type=int, default=5201)
    parser.add_argument("--fps", type=int, default=8)
    parser.add_argument("--render-size", type=int, default=320)
    parser.add_argument("--bg-color", type=parse_rgb_triplet, default=(255, 255, 255))

    parser.add_argument("--steps", type=int, default=None, help="intent値を上書き")
    parser.add_argument("--guidance-scale", type=float, default=None, help="intent値を上書き")
    parser.add_argument("--strength", type=float, default=None, help="intent値を上書き")
    parser.add_argument("--control-scale", type=float, default=None, help="intent値を上書き")

    parser.add_argument("--canny-low", type=int, default=100)
    parser.add_argument("--canny-high", type=int, default=200)
    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=1,
        help="前景マスク判定の alpha 下限 (0-255)",
    )
    parser.add_argument(
        "--motion-quadrants",
        type=parse_motion_quadrants,
        default=set(),
        help="旧指定(2x2象限)。新規は motion-grid + motion-focus-cells を使用",
    )
    parser.add_argument(
        "--motion-grid",
        type=parse_grid_size,
        default=(2, 2),
        help="局所差分評価グリッド。例: 2x2, 3x3, 4x4",
    )
    parser.add_argument(
        "--motion-focus-cells",
        type=parse_focus_cells,
        default=set(),
        help="差分集中が望ましいセル。例: r2c1,r2c2",
    )
    parser.add_argument(
        "--motion-target",
        default="",
        help="何を動かすかのメモ。例: tail, shoulder",
    )
    parser.add_argument(
        "--motion-focus-ratio-min",
        type=float,
        default=0.45,
        help="motion-quadrants 指定時の最小集中率",
    )
    parser.add_argument(
        "--temporal-diff-source",
        choices=("fg", "global"),
        default="fg",
        help="時系列ゆらぎ判定に使う差分系列",
    )
    parser.add_argument(
        "--temporal-peak-window",
        type=int,
        default=2,
        help="ピーク位置が中心から許容されるフレーム数",
    )
    parser.add_argument(
        "--temporal-min-step-ratio",
        type=float,
        default=0.6,
        help="増加/減少ステップ率の下限",
    )
    parser.add_argument(
        "--temporal-min-peak-gap",
        type=float,
        default=0.8,
        help="ピークと両端平均との差分の下限",
    )
    parser.add_argument(
        "--require-temporal-wave",
        action="store_true",
        help="増加→減少の時系列形状を合格条件に含める",
    )

    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--allow-runtime-fallbacks", action="store_true")
    parser.add_argument("--save-gif", action="store_true")
    parser.add_argument(
        "--post-upscale-chain",
        action="store_true",
        help="selected出力に 2段アップスケール後ダウンスケールを適用",
    )
    parser.add_argument("--upscayl-bin", default=DEFAULT_UPSCAYL_BIN)
    parser.add_argument("--upscayl-model-dir", default=DEFAULT_UPSCAYL_MODEL_DIR)
    parser.add_argument("--upscayl-model-name", default=DEFAULT_UPSCAYL_MODEL_NAME)
    parser.add_argument("--upscayl-passes", type=int, default=2, help="アップスケール反復回数")
    parser.add_argument(
        "--upscayl-scale-per-pass",
        type=int,
        default=2,
        help="各反復の拡大率 (2/3/4)",
    )
    parser.add_argument(
        "--post-downscale-filter",
        type=parse_resample_filter,
        default=parse_resample_filter("bicubic"),
        help="元サイズへ戻すときの補間方式: nearest/bilinear/bicubic/lanczos",
    )
    parser.add_argument("--upscayl-gpu-id", default="auto", help="upscayl -g の値")
    parser.add_argument("--upscayl-tile-size", type=int, default=0, help="upscayl -t の値")
    parser.add_argument("--upscayl-verbose", action="store_true")
    parser.add_argument("--keep-selected-raw", action="store_true")
    parser.add_argument("--keep-upscayl-workdir", action="store_true")
    return parser


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: input not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    if args.upscayl_passes < 1:
        parser.error("--upscayl-passes は 1 以上で指定してください")
    if args.upscayl_scale_per_pass not in (2, 3, 4):
        parser.error("--upscayl-scale-per-pass は 2/3/4 のみ指定できます")

    device = resolve_device(args.device)
    use_fp16 = device == "cuda"
    dtype = torch.float16 if use_fp16 else torch.float32

    intent = INTENTS[args.intent]
    steps = args.steps if args.steps is not None else intent.steps
    guidance_scale = args.guidance_scale if args.guidance_scale is not None else intent.guidance_scale
    strength = args.strength if args.strength is not None else intent.strength
    control_scale = args.control_scale if args.control_scale is not None else intent.control_scale

    out_dir = args.output
    frames_dir = out_dir / "frames"
    selected_dir = out_dir / "selected"
    out_dir.mkdir(parents=True, exist_ok=True)
    frames_dir.mkdir(parents=True, exist_ok=True)
    selected_dir.mkdir(parents=True, exist_ok=True)

    src_rgb = load_source_rgb(args.input, args.render_size, args.bg_color)
    fg_mask = load_foreground_mask(args.input, args.render_size, args.alpha_threshold)
    cond_rgb = make_condition_frame(
        src_rgb,
        mode=args.conditioning_mode,
        canny_low=args.canny_low,
        canny_high=args.canny_high,
    )
    src_rgb.save(out_dir / "source_rgb.png", "PNG")
    cond_rgb.save(out_dir / "conditioning.png", "PNG")

    print(f"Device: {device}, dtype: {dtype}")
    print(f"Intent: {args.intent} ({intent.description})")
    print(f"Base model: {args.base_model}")
    print(f"Motion adapter: {args.motion_adapter}")
    print(f"ControlNet: {args.controlnet_model}")
    print(f"Conditioning mode: {args.conditioning_mode}")
    grid_rows, grid_cols = args.motion_grid
    focus_cells = set(args.motion_focus_cells)
    if not focus_cells and args.motion_quadrants:
        legacy_map = {"tl": "r1c1", "tr": "r1c2", "bl": "r2c1", "br": "r2c2"}
        focus_cells = {legacy_map[q] for q in args.motion_quadrants}
        grid_rows, grid_cols = 2, 2
    focus_cells = validate_focus_cells(focus_cells, grid_rows, grid_cols)
    if focus_cells:
        target_txt = f", target={args.motion_target}" if args.motion_target else ""
        print(
            f"Motion regions: grid={grid_rows}x{grid_cols}, "
            f"focus={','.join(sorted(focus_cells))}, "
            f"min ratio={args.motion_focus_ratio_min:.2f}{target_txt}"
        )
    if args.post_upscale_chain:
        print(
            f"Post upscale: enabled (passes={args.upscayl_passes}, "
            f"scale/pass={args.upscayl_scale_per_pass}, model={args.upscayl_model_name})"
        )
    print(f"Allow runtime fallbacks: {args.allow_runtime_fallbacks}")

    controlnet = ControlNetModel.from_pretrained(
        args.controlnet_model,
        torch_dtype=dtype,
    )
    motion_adapter = MotionAdapter.from_pretrained(
        args.motion_adapter,
        torch_dtype=dtype,
    )

    single_file_ckpt = resolve_single_file_checkpoint(args.base_model)
    if single_file_ckpt is not None:
        print(f"Base model load mode: single_file ({single_file_ckpt})")
        pipe = AnimateDiffVideoToVideoControlNetPipeline.from_single_file(
            single_file_ckpt,
            motion_adapter=motion_adapter,
            controlnet=controlnet,
            torch_dtype=dtype,
            safety_checker=None,
            requires_safety_checker=False,
        )
    else:
        pipe = AnimateDiffVideoToVideoControlNetPipeline.from_pretrained(
            args.base_model,
            motion_adapter=motion_adapter,
            controlnet=controlnet,
            torch_dtype=dtype,
            safety_checker=None,
            requires_safety_checker=False,
        )

    pipe = pipe.to(device)
    pipe.enable_attention_slicing()
    pipe.set_progress_bar_config(disable=False)

    prompt = f"{args.prompt_prefix}, {intent.prompt_suffix}"
    negative_prompt = f"{args.negative_prompt}, {intent.negative_suffix}"

    input_video = [src_rgb.copy() for _ in range(args.num_frames)]
    conditioning_frames = [cond_rgb.copy() for _ in range(args.num_frames)]

    generator = torch.Generator(device=device).manual_seed(args.seed)

    try:
        result = pipe(
            video=input_video,
            conditioning_frames=conditioning_frames,
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            strength=strength,
            controlnet_conditioning_scale=control_scale,
            generator=generator,
            output_type="pil",
        )
    except Exception as exc:
        if not args.allow_runtime_fallbacks:
            raise
        print(f"WARN: strict run failed, runtime fallback enabled: {exc}", file=sys.stderr)
        # Fallback時も同一構成を維持し、最小限の負荷緩和のみ行う
        result = pipe(
            video=input_video,
            conditioning_frames=conditioning_frames,
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=max(steps - 4, 12),
            guidance_scale=guidance_scale,
            strength=min(strength + 0.05, 0.5),
            controlnet_conditioning_scale=control_scale,
            generator=generator,
            output_type="pil",
        )

    frames = extract_frames(result)
    if not frames:
        raise RuntimeError("生成フレームが空です")

    src_arr = np.array(src_rgb, dtype=np.float32)
    src_sharp = laplacian_var(src_arr.astype(np.uint8))

    scored: list[tuple[Image.Image, FrameScore]] = []
    for idx, frame in enumerate(frames, start=1):
        fname = f"frame_{idx:02d}.png"
        if frame.size == (args.render_size, args.render_size):
            frame_norm = frame.convert("RGB")
        else:
            frame_norm = frame.resize((args.render_size, args.render_size), Image.Resampling.NEAREST).convert("RGB")
        frame_norm.save(frames_dir / fname, "PNG")
        score = score_frame(
            frame_norm,
            frame_file=fname,
            src_arr=src_arr,
            fg_mask=fg_mask,
            src_sharp=src_sharp,
            intent=intent,
            motion_grid=(grid_rows, grid_cols),
            focus_cells=focus_cells,
            focus_ratio_min=args.motion_focus_ratio_min,
            canny_low=args.canny_low,
            canny_high=args.canny_high,
        )
        scored.append((frame_norm, score))
        focus_text = "-" if score.focus_ratio is None else f"{score.focus_ratio:.3f}"
        print(
            f"[{idx}/{len(frames)}] {fname} "
            f"{'PASS' if score.accepted else 'FAIL'} "
            f"diff={score.mean_diff:.2f} fg={score.fg_mean_diff:.2f} "
            f"iou={score.edge_iou:.3f} sharp={score.sharpness_ratio:.3f} "
            f"focus={focus_text}"
        )

    temporal_values = [s.fg_mean_diff if args.temporal_diff_source == "fg" else s.mean_diff for _, s in scored]
    temporal_analysis = analyze_temporal_wave(
        temporal_values,
        peak_window=args.temporal_peak_window,
        min_step_ratio=args.temporal_min_step_ratio,
        min_peak_gap=args.temporal_min_peak_gap,
    )
    temporal_pass = bool(temporal_analysis["passed"])
    print(
        "Temporal wave: "
        f"{'PASS' if temporal_pass else 'FAIL'} "
        f"peak={temporal_analysis['peak_index']} "
        f"inc={temporal_analysis['left_increase_ratio']} "
        f"dec={temporal_analysis['right_decrease_ratio']} "
        f"gap={temporal_analysis['peak_gap_vs_ends']}"
    )

    accepted = [item for item in scored if item[1].accepted]
    temporal_gate_blocked = args.require_temporal_wave and not temporal_pass
    if temporal_gate_blocked:
        accepted = []

    selection_fallback_used = False
    selection_reason = "accepted_frames"
    if accepted:
        ranked = sorted(accepted, key=lambda x: x[1].score, reverse=True)
        selected_ranked = ranked[: min(args.select_count, len(ranked))]
    elif temporal_gate_blocked:
        selected_ranked = []
        selection_reason = "blocked_by_temporal_gate"
        print(
            "No selected frames: --require-temporal-wave 指定時の時系列ゲートに失敗したため。",
            file=sys.stderr,
        )
    else:
        ranked = sorted(scored, key=lambda x: x[1].score, reverse=True)
        selected_ranked = ranked[: max(1, min(args.select_count, len(ranked)))]
        selection_fallback_used = True
        selection_reason = "top_scored_fallback"
        print(
            "WARN: 自動判定PASSが0件のため、上位スコアを人手レビュー候補として出力します。",
            file=sys.stderr,
        )

    def frame_sort_key(item: tuple[Image.Image, FrameScore]) -> tuple[int, str]:
        m = re.search(r"(\d+)", item[1].frame_file)
        return (int(m.group(1)), item[1].frame_file) if m else (10**9, item[1].frame_file)

    selected = sorted(selected_ranked, key=frame_sort_key)

    selected_paths: list[Path] = []
    for i, (img, score) in enumerate(selected, start=1):
        out_name = f"sway_{i:02d}.png"
        out_path = selected_dir / out_name
        img.save(out_path, "PNG")
        selected_paths.append(out_path)
        print(f"selected {out_name} <- {score.frame_file} (score={score.score:.3f})")

    postprocess_results: list[dict[str, Any]] = []
    if args.post_upscale_chain:
        up_bin = Path(args.upscayl_bin)
        up_models = Path(args.upscayl_model_dir)
        ensure_upscayl_ready(up_bin, up_models)
        work_root = out_dir / "_upscayl_work"
        for p in selected_paths:
            meta = postprocess_selected_with_upscayl(
                selected_path=p,
                work_dir=work_root / p.stem,
                render_size=args.render_size,
                bin_path=up_bin,
                model_dir=up_models,
                model_name=args.upscayl_model_name,
                passes=args.upscayl_passes,
                scale_per_pass=args.upscayl_scale_per_pass,
                downscale_filter=args.post_downscale_filter,
                keep_raw_selected=args.keep_selected_raw,
                keep_workdir=args.keep_upscayl_workdir,
                gpu_id=args.upscayl_gpu_id,
                tile_size=args.upscayl_tile_size,
                verbose=args.upscayl_verbose,
            )
            postprocess_results.append(meta)
            print(
                f"postprocess {p.name}: x{args.upscayl_scale_per_pass} * {args.upscayl_passes} "
                "-> downscale complete"
            )

    save_contact_sheet(
        source_rgb=src_rgb,
        condition_rgb=cond_rgb,
        frames=scored,
        output=out_dir / "contact_sheet.png",
    )

    if args.save_gif:
        gif_frames = [f for f, _ in scored]
        gif_frames[0].save(
            out_dir / "preview.gif",
            save_all=True,
            append_images=gif_frames[1:],
            duration=max(20, int(1000 / max(1, args.fps))),
            loop=0,
            optimize=False,
        )

    report = {
        "input": str(args.input),
        "output": str(out_dir),
        "intent": args.intent,
        "intent_config": asdict(intent),
        "model": {
            "base_model": args.base_model,
            "motion_adapter": args.motion_adapter,
            "controlnet_model": args.controlnet_model,
            "conditioning_mode": args.conditioning_mode,
        },
        "generation": {
            "num_frames": args.num_frames,
            "seed": args.seed,
            "steps": steps,
            "guidance_scale": guidance_scale,
            "strength": strength,
            "control_scale": control_scale,
            "fps": args.fps,
        },
        "evaluation": {
            "alpha_threshold": args.alpha_threshold,
            "motion_target": args.motion_target,
            "motion_grid": {"rows": grid_rows, "cols": grid_cols},
            "motion_focus_cells": sorted(focus_cells),
            "motion_quadrants_legacy": sorted(args.motion_quadrants),
            "motion_focus_ratio_min": args.motion_focus_ratio_min,
            "temporal_diff_source": args.temporal_diff_source,
            "temporal_peak_window": args.temporal_peak_window,
            "temporal_min_step_ratio": args.temporal_min_step_ratio,
            "temporal_min_peak_gap": args.temporal_min_peak_gap,
            "require_temporal_wave": args.require_temporal_wave,
        },
        "temporal_analysis": temporal_analysis,
        "selection": {
            "reason": selection_reason,
            "fallback_used": selection_fallback_used,
            "temporal_gate_blocked": temporal_gate_blocked,
        },
        "postprocess": {
            "enabled": args.post_upscale_chain,
            "upscayl_bin": args.upscayl_bin if args.post_upscale_chain else None,
            "upscayl_model_dir": args.upscayl_model_dir if args.post_upscale_chain else None,
            "upscayl_model_name": args.upscayl_model_name if args.post_upscale_chain else None,
            "upscayl_passes": args.upscayl_passes if args.post_upscale_chain else None,
            "upscayl_scale_per_pass": args.upscayl_scale_per_pass if args.post_upscale_chain else None,
            "results": postprocess_results,
        },
        "accepted_count": len(accepted),
        "selected_count": len(selected),
        "selected_files": [f"sway_{i:02d}.png" for i in range(1, len(selected) + 1)],
        "results": [asdict(s) for _, s in scored],
        "manual_review_required": True,
    }
    with open(out_dir / "report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print()
    print(f"Accepted: {len(accepted)} / {len(scored)}")
    print(f"Report: {out_dir / 'report.json'}")
    print(f"Sheet:  {out_dir / 'contact_sheet.png'}")
    print(f"Selected: {selected_dir}")


if __name__ == "__main__":
    main()
