import os
import shutil
import math
from PIL import Image, ImageEnhance, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets', 'images')
BACKUP_DIR = os.path.join(ASSETS_DIR, '.backup_original_assets')

def backup_file(rel_path):
    src = os.path.join(ASSETS_DIR, rel_path)
    dst = os.path.join(BACKUP_DIR, rel_path)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
        print(f"Backed up: {rel_path}")

def upscale_and_feather(
    rel_path,
    scale=2.5,
    feather_depths=None, # dict: {'top': 0.1, 'bottom': 0.1, 'left': 0.1, 'right': 0.1}
    sharpen=1.35,
    threshold_clean=None,
    crop_box=None # (left, top, right, bottom)
):
    backup_file(rel_path)
    full_path = os.path.join(ASSETS_DIR, rel_path)
    im = Image.open(full_path).convert('RGBA')

    if crop_box:
        im = im.crop(crop_box)

    w, h = im.size

    if threshold_clean:
        r, g, b, a = im.split()
        a_data = [0 if v <= threshold_clean else v for v in a.getdata()]
        a.putdata(a_data)
        im = Image.merge('RGBA', (r, g, b, a))

    new_w, new_h = int(w * scale), int(h * scale)
    up = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    if sharpen > 1.0:
        enhancer = ImageEnhance.Sharpness(up)
        up = enhancer.enhance(sharpen)

    r, g, b, a = up.split()
    ap = a.load()

    if feather_depths:
        for edge, depth in feather_depths.items():
            if depth <= 0: continue
            if edge == 'left':
                d = int(new_w * depth)
                for x in range(d):
                    factor = (x / d) ** 1.4
                    for y in range(new_h):
                        ap[x, y] = int(ap[x, y] * factor)
                for y in range(new_h): ap[0, y] = 0
            elif edge == 'right':
                d = int(new_w * depth)
                for x in range(new_w - d, new_w):
                    factor = ((new_w - 1 - x) / d) ** 1.4
                    for y in range(new_h):
                        ap[x, y] = int(ap[x, y] * factor)
                for y in range(new_h): ap[new_w - 1, y] = 0
            elif edge == 'top':
                d = int(new_h * depth)
                for y in range(d):
                    factor = (y / d) ** 1.4
                    for x in range(new_w):
                        ap[x, y] = int(ap[x, y] * factor)
                for x in range(new_w): ap[x, 0] = 0
            elif edge == 'bottom':
                d = int(new_h * depth)
                for y in range(new_h - d, new_h):
                    factor = ((new_h - 1 - y) / d) ** 1.4
                    for x in range(new_w):
                        ap[x, y] = int(ap[x, y] * factor)
                for x in range(new_w): ap[x, new_h - 1] = 0

    res = Image.merge('RGBA', (r, g, b, a))
    res.save(full_path, format='PNG')
    print(f"Fixed: {rel_path} -> {new_w}x{new_h}")

def keyout_background_and_upscale(
    rel_path,
    bg_ref=(231, 245, 243),
    scale=3.0,
    dist_threshold=(4, 16),
    sharpen=1.3
):
    backup_file(rel_path)
    full_path = os.path.join(ASSETS_DIR, rel_path)
    im = Image.open(full_path).convert('RGBA')
    w, h = im.size

    t_min, t_max = dist_threshold
    res_im = Image.new('RGBA', (w, h))
    for y in range(h):
        for x in range(w):
            p = im.getpixel((x, y))
            r, g, b, a = p
            dist = math.sqrt((r - bg_ref[0])**2 + (g - bg_ref[1])**2 + (b - bg_ref[2])**2)
            if dist < t_min:
                alpha = 0
            elif dist < t_max:
                alpha = int(255 * ((dist - t_min) / (t_max - t_min)) ** 1.2)
            else:
                alpha = 255
            res_im.putpixel((x, y), (r, g, b, alpha))

    new_w, new_h = int(w * scale), int(h * scale)
    up = res_im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    if sharpen > 1.0:
        up = ImageEnhance.Sharpness(up).enhance(sharpen)
    up.save(full_path, format='PNG')
    print(f"Keyed out & upscaled: {rel_path} -> {new_w}x{new_h}")

def main():
    print("=== Processing Assets for Crispness and Seamless Borders ===")

    # 1. Care Circle
    # family_3d_art: Right halo sliced, top halo sliced, bottom sliced
    upscale_and_feather(
        'care-circle/family_3d_art.png',
        scale=2.5,
        feather_depths={'top': 0.08, 'bottom': 0.05, 'right': 0.14},
        sharpen=1.35
    )
    # invite_girl: Sliced flat at bottom (chest/arms)
    upscale_and_feather(
        'care-circle/invite_girl.png',
        scale=3.0,
        feather_depths={'bottom': 0.10},
        sharpen=1.35
    )
    # empty_state_art: Low-res with ambient alpha box haze
    upscale_and_feather(
        'care-circle/empty_state_art.png',
        scale=2.5,
        threshold_clean=30,
        feather_depths={'top': 0.05, 'bottom': 0.05, 'left': 0.05, 'right': 0.05},
        sharpen=1.35
    )
    # qr_bottom_wave: Dark drop shadow line at bottom
    upscale_and_feather(
        'care-circle/qr_bottom_wave.png',
        scale=2.0,
        crop_box=(0, 0, 488, 92),
        feather_depths={'bottom': 0.12, 'left': 0.04, 'right': 0.04},
        sharpen=1.2
    )

    # 2. Profile
    # profile_header_art_vi & en: Tiny 125x107 px with flat cut left leaf and bottom stem
    for lang in ['vi', 'en']:
        upscale_and_feather(
            f'profile/profile_header_art_{lang}.png',
            scale=3.0,
            feather_depths={'left': 0.12, 'bottom': 0.08},
            sharpen=1.45
        )
    # Also update profile_header_art.png (fallback)
    if os.path.exists(os.path.join(ASSETS_DIR, 'profile/profile_header_art.png')):
        upscale_and_feather(
            'profile/profile_header_art.png',
            scale=3.0,
            feather_depths={'left': 0.12, 'bottom': 0.08},
            sharpen=1.45
        )
    # footer_quote_banner_vi & en: Right leaf cut off vertically
    for lang in ['vi', 'en']:
        upscale_and_feather(
            f'profile/footer_quote_banner_{lang}.png',
            scale=1.5,
            feather_depths={'left': 0.07, 'right': 0.08},
            sharpen=1.3
        )

    # 3. Reminders
    # morning_bg_art: Hill cut off on the right
    upscale_and_feather(
        'reminders/morning_bg_art.png',
        scale=3.0,
        feather_depths={'right': 0.15},
        sharpen=1.35
    )
    # afternoon_bg_art: Leaves cut off on the right, bottom stem
    upscale_and_feather(
        'reminders/afternoon_bg_art.png',
        scale=3.0,
        feather_depths={'right': 0.15, 'bottom': 0.08},
        sharpen=1.35
    )
    # evening_bg_art: upscale for crispness
    upscale_and_feather(
        'reminders/evening_bg_art.png',
        scale=3.0,
        feather_depths={'right': 0.05},
        sharpen=1.35
    )
    # header_leaves: Bottom horizontal line slice
    upscale_and_feather(
        'reminders/header_leaves.png',
        scale=3.0,
        feather_depths={'bottom': 0.14, 'left': 0.05},
        sharpen=1.35
    )
    # hero_bell: Opaque bounding box around bell
    keyout_background_and_upscale(
        'reminders/hero_bell.png',
        bg_ref=(231, 245, 243),
        scale=3.0,
        dist_threshold=(4, 16),
        sharpen=1.3
    )
    # hero_deco: Hard left cut
    upscale_and_feather(
        'reminders/hero_deco.png',
        scale=3.0,
        feather_depths={'left': 0.18, 'top': 0.15},
        sharpen=1.3
    )

    # 4. Missions
    # header_cross_heart: Mint background box cut off at top, right, bottom
    upscale_and_feather(
        'missions/header_cross_heart.png',
        scale=3.0,
        feather_depths={'top': 0.12, 'right': 0.16, 'bottom': 0.14},
        sharpen=1.35
    )
    # 5 mission card background artworks:
    for art in [
        'missions/mission_checkin_art.png',
        'missions/mission_bp_art.png',
        'missions/mission_glucose_art.png',
        'missions/mission_water_art.png',
        'missions/mission_weight_art.png'
    ]:
        upscale_and_feather(
            art,
            scale=2.5,
            feather_depths={'top': 0.12, 'bottom': 0.12, 'right': 0.15},
            sharpen=1.35
        )

    # 5. Subscription
    # header_leaves_left: Bottom diagonal slice across turquoise ribbon
    upscale_and_feather(
        'subscription/header_leaves_left.png',
        scale=1.5,
        feather_depths={'bottom': 0.12, 'left': 0.08},
        sharpen=1.3
    )

    print("\nAll assets processed successfully!")

if __name__ == '__main__':
    main()
