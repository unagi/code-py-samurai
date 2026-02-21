"""Phase 8: Frame-by-frame quality audit.

For each (action, direction), create a comparison image that shows:
1. All frames side by side at full resolution
2. Difference heatmap between consecutive frames
3. Pixel-level difference from frame 0 (reference candidate)

Output: comparison strips for human review + structured audit JSON.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


EXTRACTED_DIR = Path(__file__).parent.parent.parent / "from_creator" / "gemini" / "_extracted"
AUDIT_DIR = Path(__file__).parent.parent.parent / "from_creator" / "gemini" / "_audit"

SOURCES = [
    ("warrior-01", "idle", ["north", "east", "south", "west"], 4),
    ("warrior-02", "walk", ["north", "east", "south", "west"], 6),
    ("warrior-03", "attack", ["north", "east", "south", "west"], 6),
    ("warrior-04", "rest", ["left", "right"], 4),
]


def compute_structural_diff(img_a: Image.Image, img_b: Image.Image) -> tuple[float, Image.Image]:
    """Compute structural difference between two RGBA images.

    Returns (diff_score, diff_heatmap).
    diff_score: mean absolute difference across all channels (0-255 scale).
    diff_heatmap: grayscale image showing per-pixel difference magnitude.
    """
    # Resize to common size (max of both)
    w = max(img_a.width, img_b.width)
    h = max(img_a.height, img_b.height)

    canvas_a = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas_b = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Center both images
    canvas_a.paste(img_a, ((w - img_a.width) // 2, (h - img_a.height) // 2))
    canvas_b.paste(img_b, ((w - img_b.width) // 2, (h - img_b.height) // 2))

    arr_a = np.array(canvas_a, dtype=np.float32)
    arr_b = np.array(canvas_b, dtype=np.float32)

    # Per-pixel absolute difference across RGBA channels
    diff = np.abs(arr_a - arr_b)
    diff_magnitude = diff.mean(axis=2)  # Average across channels

    score = float(diff_magnitude.mean())

    # Create heatmap (amplified for visibility)
    heatmap = np.clip(diff_magnitude * 3, 0, 255).astype(np.uint8)
    heatmap_img = Image.fromarray(heatmap, mode="L")

    return score, heatmap_img


def create_comparison_strip(
    frames: list[Image.Image],
    frame_names: list[str],
    action_dir: str,
) -> Image.Image:
    """Create a comparison strip showing frames + diff heatmaps."""
    if not frames:
        return Image.new("RGBA", (100, 100), (0, 0, 0, 0))

    n = len(frames)
    max_w = max(f.width for f in frames)
    max_h = max(f.height for f in frames)

    # Layout: frames on top row, diff-from-f0 heatmaps on bottom row
    padding = 4
    label_h = 20
    strip_w = (max_w + padding) * n + padding
    strip_h = label_h + max_h + padding + max_h + label_h + padding

    strip = Image.new("RGBA", (strip_w, strip_h), (30, 30, 46, 255))
    draw = ImageDraw.Draw(strip)

    # Top row: original frames
    for i, (frame, name) in enumerate(zip(frames, frame_names)):
        x = padding + i * (max_w + padding)
        y = label_h

        # Center frame in cell
        fx = x + (max_w - frame.width) // 2
        fy = y + (max_h - frame.height) // 2
        strip.paste(frame, (fx, fy), frame)

        # Label
        draw.text((x + 2, 2), name, fill=(200, 200, 200))

    # Bottom row: diff from f0
    ref = frames[0]
    for i, frame in enumerate(frames):
        x = padding + i * (max_w + padding)
        y = label_h + max_h + padding + label_h

        score, heatmap = compute_structural_diff(ref, frame)

        # Resize heatmap to max size and center
        hm_resized = heatmap.resize((max_w, max_h), Image.NEAREST)
        hm_rgba = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 255))
        # Color: red channel = diff
        hm_arr = np.array(hm_resized)
        rgba_arr = np.zeros((max_h, max_w, 4), dtype=np.uint8)
        rgba_arr[:, :, 0] = hm_arr  # Red
        rgba_arr[:, :, 1] = hm_arr // 3  # Slight green
        rgba_arr[:, :, 3] = 255  # Opaque
        hm_colored = Image.fromarray(rgba_arr, "RGBA")

        strip.paste(hm_colored, (x, y))

        # Diff score label
        label = f"Δ={score:.1f}" if i > 0 else "REF"
        color = (100, 255, 100) if score < 5 else (255, 255, 100) if score < 15 else (255, 100, 100)
        draw.text((x + 2, y - label_h + 2), label, fill=color)

    return strip


def audit_all() -> dict:
    """Run audit on all frames, output comparison strips and audit data."""
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    audit_data: dict = {
        "description": "Phase 8 frame-by-frame structural audit",
        "groups": [],
    }

    for source_dir, action, directions, frames_per_dir in SOURCES:
        for direction in directions:
            group_key = f"{action}-{direction}"
            frames: list[Image.Image] = []
            frame_names: list[str] = []
            frame_diffs: list[dict] = []

            src_path = EXTRACTED_DIR / source_dir
            for fi in range(frames_per_dir):
                fname = f"{action}-{direction}-f{fi}.png"
                fpath = src_path / fname
                if fpath.exists():
                    img = Image.open(fpath).convert("RGBA")
                    frames.append(img)
                    frame_names.append(f"f{fi}")

            if len(frames) < 2:
                continue

            # Compute all pairwise diffs from f0
            ref = frames[0]
            scores = []
            for i, frame in enumerate(frames):
                score, _ = compute_structural_diff(ref, frame)
                scores.append(score)
                frame_diffs.append({
                    "frame": f"f{i}",
                    "diff_from_f0": round(score, 2),
                    "size": f"{frame.width}x{frame.height}",
                })

            # Also compute consecutive diffs
            consec_diffs = []
            for i in range(1, len(frames)):
                score, _ = compute_structural_diff(frames[i - 1], frames[i])
                consec_diffs.append(round(score, 2))

            # Find best candidate (most similar to majority)
            # Compute avg diff of each frame to all others
            avg_diffs = []
            for i in range(len(frames)):
                total = 0
                for j in range(len(frames)):
                    if i != j:
                        s, _ = compute_structural_diff(frames[i], frames[j])
                        total += s
                avg_diffs.append(total / (len(frames) - 1))

            best_idx = int(np.argmin(avg_diffs))

            group_info = {
                "group": group_key,
                "source": source_dir,
                "frameCount": len(frames),
                "frames": frame_diffs,
                "consecutiveDiffs": consec_diffs,
                "bestFrameIdx": best_idx,
                "bestFrame": f"f{best_idx}",
                "avgDiffFromBest": round(avg_diffs[best_idx], 2),
                "maxDiff": round(max(scores), 2),
            }
            audit_data["groups"].append(group_info)

            # Create comparison strip
            strip = create_comparison_strip(frames, frame_names, group_key)
            strip_path = AUDIT_DIR / f"{group_key}.png"
            strip.save(strip_path, "PNG")

            print(f"  {group_key}: best=f{best_idx}, "
                  f"maxΔ={max(scores):.1f}, "
                  f"diffs={[round(s, 1) for s in scores]}")

    # Save audit JSON
    audit_path = AUDIT_DIR / "audit.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2, ensure_ascii=False)

    print(f"\nAudit data: {audit_path}")
    return audit_data


if __name__ == "__main__":
    print("=== Phase 8: Frame Structural Audit ===\n")
    audit_all()
    print("\n=== Done ===")
