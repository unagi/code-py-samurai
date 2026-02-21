"""単体 rembg 背景除去ツール.

任意のRGB画像からrembg (u2net) で背景を除去し、RGBA透過PNGを出力する。
ToonCrafter出力やその他のRGB画像に対してデフォルトパラメータで動作確認済み。

実行方法:
    uv run python pipeline/rembg_transparency.py input.png -o output.png
    uv run python pipeline/rembg_transparency.py input_dir/ -o output_dir/
    uv run python pipeline/rembg_transparency.py input_dir/ -o output_dir/ --gpu
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}


def create_session(*, gpu: bool = False) -> object:
    """rembg セッションを作成."""
    if gpu:
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    else:
        providers = ["CPUExecutionProvider"]
    return new_session("u2net", providers=providers)


def remove_background(img: Image.Image, session: object) -> Image.Image:
    """画像から背景を除去してRGBA画像を返す."""
    return remove(img, session=session)


def process_single(src: Path, dst: Path, session: object) -> None:
    """1ファイルを処理."""
    img = Image.open(src).convert("RGB")
    result = remove_background(img, session)
    dst.parent.mkdir(parents=True, exist_ok=True)
    result.save(dst)
    print(f"  {src.name} -> {dst.name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="rembg (u2net) 背景除去ツール",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="入力画像ファイル or ディレクトリ",
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        required=True,
        help="出力ファイル or ディレクトリ",
    )
    parser.add_argument(
        "--gpu",
        action="store_true",
        help="CUDA GPU を使用 (要 onnxruntime-gpu + cuDNN DLL)",
    )
    args = parser.parse_args()

    input_path: Path = args.input
    output_path: Path = args.output

    if not input_path.exists():
        print(f"Error: {input_path} が見つかりません", file=sys.stderr)
        sys.exit(1)

    session = create_session(gpu=args.gpu)
    print(f"rembg session: u2net ({'GPU' if args.gpu else 'CPU'})")

    if input_path.is_file():
        # 単一ファイル
        if output_path.suffix == "":
            output_path = output_path / input_path.name
        process_single(input_path, output_path, session)
    elif input_path.is_dir():
        # ディレクトリ一括処理
        files = sorted(
            f for f in input_path.iterdir()
            if f.suffix.lower() in IMAGE_EXTENSIONS
        )
        if not files:
            print(f"Error: {input_path} に画像ファイルがありません", file=sys.stderr)
            sys.exit(1)
        print(f"{len(files)} ファイルを処理...")
        for f in files:
            dst = output_path / f.with_suffix(".png").name
            process_single(f, dst, session)
        print(f"完了: {len(files)} ファイル -> {output_path}")
    else:
        print(f"Error: {input_path} はファイルでもディレクトリでもありません", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
