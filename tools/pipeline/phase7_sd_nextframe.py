"""Phase 7: Stable Diffusion で単フレーム派生を生成.

目的:
- 2枚間補間ではなく「1枚入力 → 次フレーム候補」を生成する
- 差分を定量ゲートで管理し、人手レビュー候補を絞る
- 品質最優先のため、幾何学変形（回転・拡縮・平行移動）は行わない

基本方針:
1. 元フレームを基準画像としてそのまま使用
2. img2img で「微差分のみ」生成
3. 必要なら ControlNet(Canny) で輪郭拘束
4. 候補ごとに差分スコアを計測し、閾値で PASS/FAIL 判定
5. コンタクトシート + JSON レポートを出力して最終判断は人間が行う

実行例:
    python tools/pipeline/phase7_sd_nextframe.py \
      public/assets/sprites/samurai-cat/idle-east-frames/frame_01.png \
      -o from_creator/gemini/_sd_nextframe \
      --candidates 6 \
      --strength 0.08 \
      --seed 1234
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np
import torch
from diffusers import (
    ControlNetModel,
    StableDiffusionControlNetImg2ImgPipeline,
    StableDiffusionImg2ImgPipeline,
)
from PIL import Image, ImageDraw


DEFAULT_MODEL = "runwayml/stable-diffusion-v1-5"
DEFAULT_CONTROLNET_MODEL = "lllyasviel/sd-controlnet-canny"


@dataclass(frozen=True)
class QualityGate:
    """候補判定の閾値."""

    min_diff: float
    max_diff: float
    min_edge_iou: float
    max_centroid_shift: float
    min_area_ratio: float
    max_area_ratio: float


@dataclass(frozen=True)
class CandidateScore:
    """1候補の評価結果."""

    file: str
    seed: int
    mean_diff: float
    edge_iou: float
    centroid_shift: float
    area_ratio: float
    accepted: bool


def parse_rgb_triplet(raw: str) -> tuple[int, int, int]:
    """`R,G,B` 形式を (r,g,b) に変換."""
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("bg-color は R,G,B 形式で指定してください")
    try:
        vals = tuple(int(p) for p in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("bg-color は整数で指定してください") from exc
    if any(v < 0 or v > 255 for v in vals):
        raise argparse.ArgumentTypeError("bg-color は 0-255 の範囲で指定してください")
    return vals  # type: ignore[return-value]


def resolve_device(raw: str) -> str:
    """実行デバイスを決定."""
    if raw in ("cpu", "cuda"):
        if raw == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA が指定されましたが利用できません")
        return raw
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_pretrained_with_fallback(
    cls: type,
    model_id: str,
    *,
    dtype: torch.dtype,
    use_fp16_variant: bool,
    allow_variant_fallback: bool,
    **kwargs: object,
) -> object:
    """fp16 variant を優先し、失敗時は通常重みで再試行."""
    if use_fp16_variant:
        try:
            return cls.from_pretrained(
                model_id,
                torch_dtype=dtype,
                variant="fp16",
                **kwargs,
            )
        except Exception as exc:
            if not allow_variant_fallback:
                raise RuntimeError(
                    f"{model_id} の fp16 variant 読み込みに失敗。"
                    "品質優先モードではフォールバックしません。"
                ) from exc
            print(
                f"WARN: {model_id} の fp16 variant 読み込みに失敗。通常variantへフォールバック: {exc}",
                file=sys.stderr,
            )
    return cls.from_pretrained(
        model_id,
        torch_dtype=dtype,
        **kwargs,
    )


def resolve_single_file_checkpoint(model_spec: str) -> str | None:
    """モデル指定が single-file 形式なら checkpoint パスを返す.

    対応:
    - safetensors / ckpt のファイルパス
    - ルート直下に単体 checkpoint を持つディレクトリ
    """
    p = Path(model_spec)
    if p.is_file() and p.suffix.lower() in {".safetensors", ".ckpt"}:
        return str(p)

    if not p.is_dir():
        return None

    if (p / "model_index.json").exists():
        return None

    safetensors = sorted(p.glob("*.safetensors"))
    ckpts = sorted(p.glob("*.ckpt"))
    candidates = safetensors + ckpts
    if not candidates:
        return None

    # 品質優先: 明示的に修正版fp16を最優先
    name_lower = [c.name.lower() for c in candidates]
    for key in ("fix_fp16", "fp16", "pruned"):
        for idx, name in enumerate(name_lower):
            if key in name:
                return str(candidates[idx])
    return str(candidates[0])


def load_rgba(path: Path, render_size: int) -> Image.Image:
    """入力画像を RGBA で読み込み、指定サイズへ NEAREST で拡大."""
    img = Image.open(path).convert("RGBA")
    return img.resize((render_size, render_size), Image.Resampling.NEAREST)


def compose_on_background(img_rgba: Image.Image, bg_color: tuple[int, int, int]) -> Image.Image:
    """RGBA を指定背景色で合成して RGB 化."""
    bg = Image.new("RGB", img_rgba.size, bg_color)
    bg.paste(img_rgba, mask=img_rgba.split()[-1])
    return bg


def make_canny_control_image(
    rgb_img: Image.Image,
    *,
    low: int,
    high: int,
) -> Image.Image:
    """ControlNet 用 Canny 画像を作成."""
    arr = np.array(rgb_img.convert("L"), dtype=np.uint8)
    edges = cv2.Canny(arr, low, high)
    rgb = np.stack([edges, edges, edges], axis=2)
    return Image.fromarray(rgb, mode="RGB")


def build_target_mask(target_rgba: Image.Image) -> np.ndarray:
    """評価対象の前景マスクを作成."""
    alpha = np.array(target_rgba.split()[-1], dtype=np.uint8)
    mask = (alpha > 16).astype(np.uint8) * 255
    kernel = np.ones((5, 5), dtype=np.uint8)
    dilated = cv2.dilate(mask, kernel, iterations=1)
    return dilated > 0


def safe_centroid(mask: np.ndarray) -> tuple[float, float] | None:
    """二値マスクの重心を返す."""
    ys, xs = np.nonzero(mask)
    if ys.size == 0:
        return None
    return (float(xs.mean()), float(ys.mean()))


def compute_edge_iou(
    a_rgb: np.ndarray,
    b_rgb: np.ndarray,
    *,
    low: int,
    high: int,
) -> float:
    """2画像の Canny edge IoU."""
    a_gray = cv2.cvtColor(a_rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    b_gray = cv2.cvtColor(b_rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)

    a_edge = cv2.Canny(a_gray, low, high) > 0
    b_edge = cv2.Canny(b_gray, low, high) > 0

    union = np.logical_or(a_edge, b_edge).sum()
    if union == 0:
        return 1.0
    inter = np.logical_and(a_edge, b_edge).sum()
    return float(inter / union)


def evaluate_candidate(
    candidate_rgb: Image.Image,
    *,
    candidate_file: str,
    seed: int,
    target_rgb: Image.Image,
    target_mask: np.ndarray,
    target_centroid: tuple[float, float] | None,
    bg_color: tuple[int, int, int],
    fg_threshold: int,
    canny_low: int,
    canny_high: int,
    gate: QualityGate,
) -> CandidateScore:
    """候補の定量評価 + PASS/FAIL 判定."""
    cand = candidate_rgb.resize(target_rgb.size, Image.Resampling.BICUBIC)
    cand_arr = np.array(cand, dtype=np.float32)
    target_arr = np.array(target_rgb, dtype=np.float32)

    if target_mask.sum() == 0:
        valid_mask = np.ones(target_mask.shape, dtype=bool)
    else:
        valid_mask = target_mask

    # 前景領域での平均絶対差分 (0-255)
    mean_diff = float(np.mean(np.abs(cand_arr[valid_mask] - target_arr[valid_mask])))

    # 輪郭一致度 (0-1)
    edge_iou = compute_edge_iou(
        cand_arr,
        target_arr,
        low=canny_low,
        high=canny_high,
    )

    # 背景色との差分から推定した候補前景
    bg = np.array(bg_color, dtype=np.float32)
    delta = np.max(np.abs(cand_arr - bg), axis=2)
    cand_fg = delta >= float(fg_threshold)
    cand_fg = cv2.morphologyEx(
        cand_fg.astype(np.uint8) * 255,
        cv2.MORPH_OPEN,
        np.ones((3, 3), dtype=np.uint8),
    ) > 0

    target_area = int(valid_mask.sum())
    cand_area = int(cand_fg.sum())
    area_ratio = float(cand_area / target_area) if target_area > 0 else 1.0

    cand_centroid = safe_centroid(cand_fg)
    if target_centroid is None or cand_centroid is None:
        centroid_shift = float("inf")
    else:
        dx = cand_centroid[0] - target_centroid[0]
        dy = cand_centroid[1] - target_centroid[1]
        centroid_shift = float(math.hypot(dx, dy))

    accepted = (
        gate.min_diff <= mean_diff <= gate.max_diff
        and edge_iou >= gate.min_edge_iou
        and centroid_shift <= gate.max_centroid_shift
        and gate.min_area_ratio <= area_ratio <= gate.max_area_ratio
    )

    return CandidateScore(
        file=candidate_file,
        seed=seed,
        mean_diff=round(mean_diff, 3),
        edge_iou=round(edge_iou, 4),
        centroid_shift=round(centroid_shift, 3),
        area_ratio=round(area_ratio, 4),
        accepted=accepted,
    )


def save_contact_sheet(
    *,
    source_rgb: Image.Image,
    target_rgb: Image.Image,
    control_rgb: Image.Image | None,
    candidates: list[tuple[Image.Image, CandidateScore]],
    output_path: Path,
) -> None:
    """比較しやすいコンタクトシートを保存."""
    cards: list[tuple[str, Image.Image, bool | None]] = [
        ("source", source_rgb, None),
        ("target_pose", target_rgb, None),
    ]
    if control_rgb is not None:
        cards.append(("control_canny", control_rgb, None))
    for idx, (img, score) in enumerate(candidates, start=1):
        label = (
            f"{idx:02d} {'PASS' if score.accepted else 'FAIL'} "
            f"d={score.mean_diff:.1f} "
            f"iou={score.edge_iou:.2f} "
            f"shift={score.centroid_shift:.1f}"
        )
        cards.append((label, img, score.accepted))

    cols = 4
    rows = math.ceil(len(cards) / cols)
    w, h = source_rgb.size
    pad = 8
    label_h = 42
    cell_h = h + label_h

    sheet_w = pad + cols * (w + pad)
    sheet_h = pad + rows * (cell_h + pad)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)

    for idx, (label, img, accepted) in enumerate(cards):
        row = idx // cols
        col = idx % cols
        x = pad + col * (w + pad)
        y = pad + row * (cell_h + pad)

        if accepted is True:
            border = (110, 220, 110)
        elif accepted is False:
            border = (240, 120, 120)
        else:
            border = (170, 170, 170)

        draw.rectangle((x, y, x + w, y + cell_h), outline=border, width=2)
        draw.text((x + 5, y + 5), label, fill=border)
        sheet.paste(img, (x, y + label_h))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")


def create_parser() -> argparse.ArgumentParser:
    """CLI parser."""
    parser = argparse.ArgumentParser(
        description="Phase 7: SD単フレーム派生 + 差分ゲート",
    )
    parser.add_argument("input", type=Path, help="元フレーム PNG")
    parser.add_argument("-o", "--output", type=Path, required=True, help="出力ディレクトリ")

    parser.add_argument("--model", default=DEFAULT_MODEL, help="Stable Diffusion model id")
    parser.add_argument(
        "--controlnet-model",
        default=DEFAULT_CONTROLNET_MODEL,
        help="ControlNet model id (control=canny のとき使用)",
    )
    parser.add_argument(
        "--control",
        choices=("none", "canny"),
        default="canny",
        help="構造拘束モード",
    )

    parser.add_argument(
        "--prompt",
        default=(
            "pixel art sprite, same character, same costume, "
            "same palette, tiny pose change, clean silhouette"
        ),
        help="正プロンプト",
    )
    parser.add_argument(
        "--negative-prompt",
        default=(
            "deformed, extra limbs, blurry, smeared, text, watermark, "
            "background scene, realistic photo"
        ),
        help="負プロンプト",
    )

    parser.add_argument("--candidates", type=int, default=6, help="生成候補数")
    parser.add_argument("--seed", type=int, default=1234, help="先頭seed")
    parser.add_argument("--steps", type=int, default=25, help="推論ステップ")
    parser.add_argument("--strength", type=float, default=0.28, help="img2img強度 (0-1)")
    parser.add_argument("--guidance-scale", type=float, default=5.0, help="CFGスケール")
    parser.add_argument(
        "--control-scale",
        type=float,
        default=0.85,
        help="ControlNet conditioning scale",
    )

    parser.add_argument("--render-size", type=int, default=320, help="作業解像度")
    parser.add_argument(
        "--shift-x",
        type=int,
        default=0,
        help="品質優先では使用禁止（互換用。必ず 0）",
    )
    parser.add_argument(
        "--shift-y",
        type=int,
        default=0,
        help="品質優先では使用禁止（互換用。必ず 0）",
    )
    parser.add_argument(
        "--rotate-deg",
        type=float,
        default=0.0,
        help="品質優先では使用禁止（互換用。必ず 0）",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="品質優先では使用禁止（互換用。必ず 1.0）",
    )
    parser.add_argument(
        "--bg-color",
        type=parse_rgb_triplet,
        default=(255, 255, 255),
        help="SD入力時の背景色 R,G,B",
    )

    parser.add_argument("--canny-low", type=int, default=100, help="Canny low threshold")
    parser.add_argument("--canny-high", type=int, default=200, help="Canny high threshold")
    parser.add_argument("--fg-threshold", type=int, default=18, help="前景推定しきい値")

    parser.add_argument("--min-diff", type=float, default=4.0, help="許容差分下限")
    parser.add_argument("--max-diff", type=float, default=28.0, help="許容差分上限")
    parser.add_argument("--min-edge-iou", type=float, default=0.35, help="輪郭IoU下限")
    parser.add_argument(
        "--max-centroid-shift",
        type=float,
        default=14.0,
        help="前景重心ズレ上限(px)",
    )
    parser.add_argument("--min-area-ratio", type=float, default=0.75, help="面積比下限")
    parser.add_argument("--max-area-ratio", type=float, default=1.35, help="面積比上限")

    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default="auto",
        help="実行デバイス",
    )
    parser.add_argument(
        "--no-fp16",
        action="store_true",
        help="fp16 variant の利用を無効化",
    )
    parser.add_argument(
        "--allow-runtime-fallbacks",
        action="store_true",
        help="実行継続優先のフォールバックを許可 (デフォルトは品質優先で禁止)",
    )
    return parser


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: input not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    if (
        args.shift_x != 0
        or args.shift_y != 0
        or abs(args.rotate_deg) > 1e-8
        or abs(args.scale - 1.0) > 1e-8
    ):
        print(
            "Error: 品質優先モードでは幾何学変形を禁止しています。"
            " --shift-x=0 --shift-y=0 --rotate-deg=0 --scale=1.0 を使用してください。",
            file=sys.stderr,
        )
        sys.exit(1)

    device = resolve_device(args.device)
    use_fp16_variant = (device == "cuda") and (not args.no_fp16)
    dtype = torch.float16 if use_fp16_variant else torch.float32
    allow_runtime_fallbacks = args.allow_runtime_fallbacks

    gate = QualityGate(
        min_diff=args.min_diff,
        max_diff=args.max_diff,
        min_edge_iou=args.min_edge_iou,
        max_centroid_shift=args.max_centroid_shift,
        min_area_ratio=args.min_area_ratio,
        max_area_ratio=args.max_area_ratio,
    )

    out_dir = args.output
    candidates_dir = out_dir / "candidates"
    out_dir.mkdir(parents=True, exist_ok=True)
    candidates_dir.mkdir(parents=True, exist_ok=True)

    source_rgba = load_rgba(args.input, args.render_size)
    target_pose_rgba = source_rgba.copy()

    source_rgb = compose_on_background(source_rgba, args.bg_color)
    target_pose_rgb = compose_on_background(target_pose_rgba, args.bg_color)
    control_rgb = (
        make_canny_control_image(
            target_pose_rgb,
            low=args.canny_low,
            high=args.canny_high,
        )
        if args.control == "canny"
        else None
    )

    source_rgb.save(out_dir / "source_rgb.png", "PNG")
    target_pose_rgb.save(out_dir / "target_pose_rgb.png", "PNG")
    if control_rgb is not None:
        control_rgb.save(out_dir / "control_canny.png", "PNG")

    print(f"Device: {device}, dtype: {dtype}")
    print(f"Model: {args.model}")
    print(f"Control: {args.control}")
    print(f"Candidates: {args.candidates}, seed: {args.seed}")
    print(f"Allow runtime fallbacks: {allow_runtime_fallbacks}")

    checkpoint_path = resolve_single_file_checkpoint(args.model)

    if args.control == "none":
        if checkpoint_path is not None:
            print(f"Model load mode: single_file ({checkpoint_path})")
            pipe = StableDiffusionImg2ImgPipeline.from_single_file(
                checkpoint_path,
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
            )
        else:
            pipe = load_pretrained_with_fallback(
                StableDiffusionImg2ImgPipeline,
                args.model,
                dtype=dtype,
                use_fp16_variant=use_fp16_variant,
                allow_variant_fallback=allow_runtime_fallbacks,
                safety_checker=None,
                requires_safety_checker=False,
            )
    else:
        controlnet = load_pretrained_with_fallback(
            ControlNetModel,
            args.controlnet_model,
            dtype=dtype,
            use_fp16_variant=use_fp16_variant,
            allow_variant_fallback=allow_runtime_fallbacks,
        )
        if checkpoint_path is not None:
            print(f"Model load mode: single_file ({checkpoint_path})")
            pipe = StableDiffusionControlNetImg2ImgPipeline.from_single_file(
                checkpoint_path,
                controlnet=controlnet,
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
            )
        else:
            pipe = load_pretrained_with_fallback(
                StableDiffusionControlNetImg2ImgPipeline,
                args.model,
                dtype=dtype,
                use_fp16_variant=use_fp16_variant,
                allow_variant_fallback=allow_runtime_fallbacks,
                controlnet=controlnet,
                safety_checker=None,
                requires_safety_checker=False,
            )

    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=False)
    pipe.enable_attention_slicing()

    target_mask = build_target_mask(target_pose_rgba)
    target_centroid = safe_centroid(target_mask)

    candidates: list[tuple[Image.Image, CandidateScore]] = []
    report_items: list[CandidateScore] = []

    for idx in range(args.candidates):
        seed = args.seed + idx
        generator = torch.Generator(device=device).manual_seed(seed)

        common_kwargs = {
            "prompt": args.prompt,
            "negative_prompt": args.negative_prompt,
            "image": target_pose_rgb,
            "strength": args.strength,
            "guidance_scale": args.guidance_scale,
            "num_inference_steps": args.steps,
            "generator": generator,
        }

        if args.control == "none":
            result = pipe(**common_kwargs)
        else:
            result = pipe(
                **common_kwargs,
                control_image=control_rgb,
                controlnet_conditioning_scale=args.control_scale,
            )

        img = result.images[0].convert("RGB")
        out_name = f"candidate_{idx + 1:02d}.png"
        img.save(candidates_dir / out_name, "PNG")

        score = evaluate_candidate(
            img,
            candidate_file=out_name,
            seed=seed,
            target_rgb=target_pose_rgb,
            target_mask=target_mask,
            target_centroid=target_centroid,
            bg_color=args.bg_color,
            fg_threshold=args.fg_threshold,
            canny_low=args.canny_low,
            canny_high=args.canny_high,
            gate=gate,
        )
        candidates.append((img, score))
        report_items.append(score)
        verdict = "PASS" if score.accepted else "FAIL"
        print(
            f"[{idx + 1}/{args.candidates}] {out_name} {verdict} "
            f"diff={score.mean_diff:.2f} "
            f"iou={score.edge_iou:.3f} "
            f"shift={score.centroid_shift:.2f} "
            f"area={score.area_ratio:.3f}"
        )

    accepted = [s for s in report_items if s.accepted]
    report = {
        "input": str(args.input),
        "output": str(out_dir),
        "model": args.model,
        "control": args.control,
        "controlnet_model": args.controlnet_model if args.control != "none" else None,
        "generation": {
            "candidates": args.candidates,
            "seed_start": args.seed,
            "steps": args.steps,
            "strength": args.strength,
            "guidance_scale": args.guidance_scale,
            "control_scale": args.control_scale if args.control != "none" else None,
        },
        "target_pose": {
            "mode": "no-geometric-transform",
            "shift_x": 0,
            "shift_y": 0,
            "rotate_deg": 0.0,
            "scale": 1.0,
        },
        "quality_gate": asdict(gate),
        "accepted_count": len(accepted),
        "accepted_files": [s.file for s in accepted],
        "manual_review_required": True,
        "results": [asdict(s) for s in report_items],
    }

    with open(out_dir / "report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    save_contact_sheet(
        source_rgb=source_rgb,
        target_rgb=target_pose_rgb,
        control_rgb=control_rgb,
        candidates=candidates,
        output_path=out_dir / "contact_sheet.png",
    )

    print()
    print(f"Accepted: {len(accepted)} / {len(report_items)}")
    print(f"Report: {out_dir / 'report.json'}")
    print(f"Sheet:  {out_dir / 'contact_sheet.png'}")
    print("NOTE: 最終採否は contact_sheet.png を人間レビューで判定してください。")


if __name__ == "__main__":
    main()
