"""Independent, optional Pillow proof for the source-bound GIF browser corpus."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, __version__ as pillow_version


def verify(index_path):
    root = index_path.resolve().parent
    index = json.loads(index_path.read_text(encoding="utf-8"))
    frames = 0
    for item in index["files"]:
        target = (root / item["path"]).resolve()
        if not target.is_relative_to(root) or target.suffix != ".gif":
            raise ValueError("GIF evidence path escapes its index root")
        with Image.open(target) as image:
            assert image.format == "GIF", item["path"]
            assert image.size == (item["width"], item["height"]), item["path"]
            assert image.n_frames == len(item["frames"]), item["path"]
            assert image.info.get("loop") == 0, item["path"]
            elapsed = 0
            for position, expected in enumerate(item["frames"]):
                image.seek(position)
                actual = hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()
                assert actual == expected["sha256"], (item["path"], position, actual)
                duration = image.info.get("duration")
                assert duration == item["delaysCs"][position] * 10, (item["path"], position, duration)
                elapsed += duration
                assert abs(elapsed - (position + 1) * 1000 / item["fps"]) <= 5.000001
                frames += 1
    return {"status": "passed", "decoder": "Pillow " + pillow_version,
            "gifs": len(index["files"]), "frames": frames, "differentBytes": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.index), separators=(",", ":")))
