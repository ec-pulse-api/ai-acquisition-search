from pathlib import Path
from PIL import Image

source = Path("mobile/assets/icon.png")
if not source.exists():
    raise SystemExit("mobile/assets/icon.png not found")

icon = Image.open(source).convert("RGBA")

android = Path("android/app/src/main/res")
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
for folder, size in sizes.items():
    out = android / folder
    out.mkdir(parents=True, exist_ok=True)
    rendered = icon.resize((size, size), Image.Resampling.LANCZOS)
    rendered.save(out / "ic_launcher.png", optimize=True)
    rendered.save(out / "ic_launcher_round.png", optimize=True)

ios = Path("ios/App/App/Assets.xcassets/AppIcon.appiconset")
ios.mkdir(parents=True, exist_ok=True)
entries = []
for px, filename, scale in [
    (40, "Icon-20@2x.png", "2x"), (60, "Icon-20@3x.png", "3x"),
    (58, "Icon-29@2x.png", "2x"), (87, "Icon-29@3x.png", "3x"),
    (80, "Icon-40@2x.png", "2x"), (120, "Icon-40@3x.png", "3x"),
    (120, "Icon-60@2x.png", "2x"), (180, "Icon-60@3x.png", "3x"),
    (1024, "Icon-1024.png", "1x"),
]:
    icon.resize((px, px), Image.Resampling.LANCZOS).save(ios / filename, optimize=True)
    size = {2: "20x20", 3: "20x20", 29: "29x29", 40: "40x40", 60: "60x60", 1024: "1024x1024"}.get(px, "20x20")
    if px == 58: size = "29x29"
    elif px == 87: size = "29x29"
    elif px == 80: size = "40x40"
    elif px == 120 and filename.startswith("Icon-40"): size = "40x40"
    elif px == 120: size = "60x60"
    elif px == 180: size = "60x60"
    entries.append({"idiom":"iphone","size":size,"scale":scale,"filename":filename})

import json
(ios / "Contents.json").write_text(json.dumps({"images": entries, "info": {"author":"xcode","version":1}}, indent=2), encoding="utf-8")
print("Generated Android and iOS native icon assets.")
