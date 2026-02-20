#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROLE_DIRS = {"warrior", "sludge", "thick-sludge", "archer", "wizard", "captive", "golem"}


def load_overrides(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        pack, role = parts[0].strip(), parts[1].strip()
        if pack and role:
            out[pack] = role
    return out


def infer_role(pack_name: str, files: list[Path], overrides: dict[str, str]) -> str:
    if pack_name in overrides:
        return overrides[pack_name]

    names = [p.name.lower() for p in files if p.is_file()]

    def has_any(prefixes: tuple[str, ...]) -> bool:
        return any(any(n.startswith(p) for p in prefixes) for n in names)

    if has_any(("bound", "rescued")):
        return "captive"
    if has_any(("shoot", "projectile-kaki")):
        return "archer"
    if has_any(("cast", "projectile-flame")):
        return "wizard"
    if has_any(("rescue", "rest", "victory")):
        return "warrior"
    if has_any(("idle-north", "idle-east", "idle-south", "idle-west", "walk-north", "walk-east", "walk-south", "walk-west", "attack-north", "attack-east", "attack-south", "attack-west")):
        return "warrior"

    return "unknown"


def reorganize(root: Path, overrides: dict[str, str]) -> int:
    if not root.exists():
        return 0

    moved = 0
    pack_dirs = [p for p in root.iterdir() if p.is_dir() and p.name not in ROLE_DIRS]
    for pack in pack_dirs:
        files = list(pack.iterdir())
        role = infer_role(pack.name, files, overrides)
        role_dir = root / role
        role_dir.mkdir(parents=True, exist_ok=True)
        dst = role_dir / pack.name

        if dst.exists():
            shutil.rmtree(dst)
        shutil.move(str(pack), str(dst))
        moved += 1

    return moved


def apply_unknown_overrides(root: Path, overrides: dict[str, str]) -> int:
    unknown_dir = root / "unknown"
    if not unknown_dir.exists():
        return 0

    moved = 0
    for pack in [p for p in unknown_dir.iterdir() if p.is_dir()]:
        role = overrides.get(pack.name, "unknown")
        if role == "unknown":
            continue
        role_dir = root / role
        role_dir.mkdir(parents=True, exist_ok=True)
        dst = role_dir / pack.name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.move(str(pack), str(dst))
        moved += 1
    return moved


def find_unknown_packs(root: Path) -> list[str]:
    unknown_dir = root / "unknown"
    if not unknown_dir.exists():
        return []
    return sorted([p.name for p in unknown_dir.iterdir() if p.is_dir()])


def ensure_role_dirs(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for role in sorted(ROLE_DIRS):
        (root / role).mkdir(parents=True, exist_ok=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Reorganize sprites into role-based directories.")
    ap.add_argument("--delivery-root", default="assets/delivery/final/sprites")
    ap.add_argument("--public-root", default="public/assets/sprites")
    ap.add_argument("--overrides", default="assets/specs/role-pack-overrides.tsv")
    ap.add_argument(
        "--strict",
        action="store_true",
        help="Fail when unresolved packs remain under unknown/.",
    )
    args = ap.parse_args()

    overrides = load_overrides(Path(args.overrides))

    moved_delivery = reorganize(Path(args.delivery_root), overrides)
    moved_public = reorganize(Path(args.public_root), overrides)
    moved_delivery += apply_unknown_overrides(Path(args.delivery_root), overrides)
    moved_public += apply_unknown_overrides(Path(args.public_root), overrides)

    ensure_role_dirs(Path(args.delivery_root))
    ensure_role_dirs(Path(args.public_root))

    unresolved_delivery = find_unknown_packs(Path(args.delivery_root))
    unresolved_public = find_unknown_packs(Path(args.public_root))
    unresolved = sorted(set(unresolved_delivery + unresolved_public))

    print(f"moved_delivery={moved_delivery}")
    print(f"moved_public={moved_public}")
    print(f"unresolved_unknown_packs={len(unresolved)}")
    if unresolved:
        print("unresolved=" + ",".join(unresolved))
    if args.strict and unresolved:
        sys.exit(1)


if __name__ == "__main__":
    main()
