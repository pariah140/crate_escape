"""Draw original, vector-like harbor art for the iOS icon and splash screens."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "ios/App/App/Assets.xcassets"
FONT = Path("/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf")


def polygon(draw, points, fill):
    draw.polygon(points, fill=fill)


def harbor(size: int, splash: bool) -> Image.Image:
    s = size / 1024
    image = Image.new("RGB", (size, size), "#0d8294")
    draw = ImageDraw.Draw(image)

    # Broad bands of low-poly water and sunlight.
    polygon(draw, [(0, 0), (size, 0), (size, int(155*s)), (0, int(353*s))], "#118da0")
    polygon(draw, [(0, int(710*s)), (size, int(467*s)), (size, size), (0, size)], "#08798e")
    for i in range(24):
        x = ((i * 191) % 960 + 35) * s
        y = ((i * 277) % 880 + 70) * s
        width = (24 + i % 4 * 13) * s
        draw.rounded_rectangle((x, y, x + width, y + 5*s), radius=2*s, fill="#63c6c7")

    # A sandy island and toy lighthouse sit behind the boat.
    polygon(draw, [(790*s, 150*s), (944*s, 192*s), (1012*s, 328*s), (937*s, 410*s), (775*s, 374*s), (715*s, 256*s)], "#e9bd77")
    polygon(draw, [(783*s, 138*s), (948*s, 180*s), (991*s, 306*s), (925*s, 369*s), (776*s, 337*s), (732*s, 249*s)], "#f7d28a")
    polygon(draw, [(794*s, 159*s), (933*s, 193*s), (960*s, 291*s), (907*s, 334*s), (785*s, 310*s), (758*s, 237*s)], "#75c487")
    draw.ellipse((830*s, 154*s, 921*s, 189*s), fill="#55717b")
    polygon(draw, [(845*s, 166*s), (907*s, 166*s), (900*s, 78*s), (852*s, 78*s)], "#fff1cc")
    polygon(draw, [(852*s, 78*s), (900*s, 78*s), (911*s, 62*s), (841*s, 62*s)], "#f8795d")
    draw.ellipse((857*s, 99*s, 894*s, 122*s), fill="#ffd85a")

    # Deep hull shadow and foam make the boat read clearly at small sizes.
    polygon(draw, [(210*s, 512*s), (543*s, 402*s), (755*s, 547*s), (690*s, 827*s), (410*s, 925*s), (192*s, 724*s)], "#075466")
    draw.arc((164*s, 440*s, 810*s, 969*s), 8, 165, fill="#a6e8db", width=int(16*s))
    draw.arc((220*s, 474*s, 753*s, 922*s), 6, 166, fill="#6fd1ce", width=int(9*s))
    polygon(draw, [(198*s, 438*s), (505*s, 333*s), (728*s, 486*s), (681*s, 755*s), (414*s, 849*s), (202*s, 671*s)], "#9b5144")
    polygon(draw, [(196*s, 425*s), (501*s, 324*s), (721*s, 473*s), (668*s, 741*s), (410*s, 827*s), (190*s, 650*s)], "#ff8458")
    polygon(draw, [(266*s, 461*s), (495*s, 387*s), (663*s, 499*s), (626*s, 694*s), (420*s, 761*s), (261*s, 628*s)], "#fff0c8")
    polygon(draw, [(470*s, 351*s), (498*s, 264*s), (555*s, 391*s)], "#ffad66")
    polygon(draw, [(300*s, 499*s), (400*s, 468*s), (456*s, 516*s), (352*s, 549*s)], "#f7bc51")
    polygon(draw, [(352*s, 549*s), (456*s, 516*s), (451*s, 595*s), (349*s, 632*s)], "#e59a3c")
    polygon(draw, [(300*s, 499*s), (352*s, 549*s), (349*s, 632*s), (300*s, 581*s)], "#ffd765")
    polygon(draw, [(438*s, 465*s), (539*s, 429*s), (598*s, 477*s), (488*s, 519*s)], "#8fe0b6")
    polygon(draw, [(488*s, 519*s), (598*s, 477*s), (593*s, 557*s), (486*s, 598*s)], "#5cae91")
    polygon(draw, [(438*s, 465*s), (488*s, 519*s), (486*s, 598*s), (438*s, 543*s)], "#b0ebc6")
    polygon(draw, [(349*s, 652*s), (459*s, 620*s), (519*s, 670*s), (408*s, 711*s)], "#ffa6af")
    polygon(draw, [(408*s, 711*s), (519*s, 670*s), (514*s, 740*s), (406*s, 783*s)], "#dc7c8c")
    polygon(draw, [(349*s, 652*s), (408*s, 711*s), (406*s, 783*s), (347*s, 724*s)], "#ffc0b9")
    polygon(draw, [(274*s, 407*s), (317*s, 392*s), (328*s, 411*s), (284*s, 427*s)], "#fff8dc")
    polygon(draw, [(601*s, 725*s), (638*s, 704*s), (627*s, 776*s), (590*s, 790*s)], "#ffe28c")

    if splash:
        title = "CRATE ESCAPE"
        font = ImageFont.truetype(str(FONT), int(72*s)) if FONT.exists() else ImageFont.load_default()
        tagline_font = ImageFont.truetype(str(FONT), int(25*s)) if FONT.exists() else ImageFont.load_default()
        bounds = draw.textbbox((0, 0), title, font=font)
        x = (size - (bounds[2] - bounds[0])) / 2
        draw.text((x + 3*s, 878*s + 5*s), title, font=font, fill="#064f5f")
        draw.text((x, 878*s), title, font=font, fill="#fff3d4")
        tagline = "PACK IT  ·  RUN IT  ·  DON'T GET CAUGHT"
        bounds = draw.textbbox((0, 0), tagline, font=tagline_font)
        draw.text(((size - (bounds[2] - bounds[0])) / 2, 971*s), tagline, font=tagline_font, fill="#ffe17c")
    return image


def main():
    icon = ASSETS / "AppIcon.appiconset/AppIcon-512@2x.png"
    icon.parent.mkdir(parents=True, exist_ok=True)
    harbor(1024, False).save(icon, optimize=True)
    splash = harbor(2732, True)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        splash.save(ASSETS / "Splash.imageset" / name, optimize=True)
    print("Generated Crate Escape icon and splash art")


if __name__ == "__main__":
    main()
