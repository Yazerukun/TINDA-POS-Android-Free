import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_tinda_brand_assets():
    os.makedirs('scripts', exist_ok=True)
    size = 1024
    
    # 1. GENERATE ICON (1024x1024 supersampled)
    icon_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Create mask for rounded squircle (super smooth curves)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    margin = 56
    radius = 230
    mask_draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=radius, fill=255)
    
    # Gradient background: Vibrant Emerald to Deep Forest (#10b981 -> #047857)
    grad = Image.new('RGBA', (size, size))
    grad_draw = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / size
        # #10b981 (16, 185, 129) at top to #047857 (4, 120, 87) at bottom
        r = int(16 * (1 - t) + 4 * t)
        g = int(185 * (1 - t) + 120 * t)
        b = int(129 * (1 - t) + 87 * t)
        grad_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
        
    icon_img.paste(grad, (0, 0), mask)
    
    # Inner subtle glow border
    glow_mask = Image.new('L', (size, size), 0)
    glow_draw = ImageDraw.Draw(glow_mask)
    glow_draw.rounded_rectangle([margin + 4, margin + 4, size - margin - 4, size - margin - 4], radius=radius - 4, outline=255, width=6)
    white_line = Image.new('RGBA', (size, size), (255, 255, 255, 45))
    icon_img.paste(white_line, (0, 0), glow_mask)
    
    draw = ImageDraw.Draw(icon_img)
    
    # DRAW STORE CANOPY & REGISTER ICON
    # Store Roof / Awning:
    roof_top_y = 230
    roof_bot_y = 390
    roof_left_x = 210
    roof_right_x = size - 210
    
    # Awning shadow
    shadow_mask = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_draw.polygon([
        (roof_left_x - 10, roof_bot_y + 10),
        (roof_right_x + 10, roof_bot_y + 10),
        (roof_right_x - 30, roof_bot_y + 80),
        (roof_left_x + 30, roof_bot_y + 80)
    ], fill=(0, 40, 20, 60))
    icon_img = Image.alpha_composite(icon_img, shadow_mask)
    draw = ImageDraw.Draw(icon_img)
    
    # Store Body / Counter
    counter_left = 260
    counter_right = size - 260
    counter_top = roof_bot_y + 10
    counter_bot = 710
    draw.rounded_rectangle([counter_left, counter_top, counter_right, counter_bot], radius=32, fill=(255, 255, 255, 245))
    
    # Screen / Register window on counter
    screen_left = counter_left + 45
    screen_right = counter_right - 45
    screen_top = counter_top + 45
    screen_bot = counter_top + 230
    draw.rounded_rectangle([screen_left, screen_top, screen_right, screen_bot], radius=24, fill=(15, 23, 42, 255))
    
    # Green Screen Glow / Content lines
    s_draw = ImageDraw.Draw(icon_img)
    s_draw.rounded_rectangle([screen_left + 30, screen_top + 35, screen_left + 160, screen_top + 55], radius=10, fill=(52, 211, 153, 230))
    s_draw.rounded_rectangle([screen_left + 30, screen_top + 75, screen_left + 240, screen_top + 95], radius=10, fill=(148, 163, 184, 180))
    
    # Large Radiant Checkmark in Screen
    chk_color = (16, 185, 129, 255)
    pts = [
        (screen_left + 140, screen_top + 145),
        (screen_left + 175, screen_top + 180),
        (screen_left + 265, screen_top + 100)
    ]
    s_draw.line([pts[0], pts[1]], fill=chk_color, width=22)
    s_draw.line([pts[1], pts[2]], fill=chk_color, width=22)
    # round joins
    s_draw.ellipse([pts[0][0]-11, pts[0][1]-11, pts[0][0]+11, pts[0][1]+11], fill=chk_color)
    s_draw.ellipse([pts[1][0]-11, pts[1][1]-11, pts[1][0]+11, pts[1][1]+11], fill=chk_color)
    s_draw.ellipse([pts[2][0]-11, pts[2][1]-11, pts[2][0]+11, pts[2][1]+11], fill=chk_color)
    
    # Gold Coin / Star badge in corner of counter
    coin_x = counter_right - 40
    coin_y = counter_bot - 45
    s_draw.ellipse([coin_x - 55, coin_y - 55, coin_x + 55, coin_y + 55], fill=(245, 158, 11, 255))
    s_draw.ellipse([coin_x - 45, coin_y - 45, coin_x + 45, coin_y + 45], outline=(254, 240, 138, 255), width=6)
    # Peso mark 'P'
    s_draw.line([(coin_x - 14, coin_y - 25), (coin_x - 14, coin_y + 25)], fill=(255, 255, 255, 255), width=8)
    s_draw.arc([coin_x - 14, coin_y - 25, coin_x + 20, coin_y + 3], start=270, end=90, fill=(255, 255, 255, 255), width=8)
    s_draw.line([(coin_x - 22, coin_y - 10), (coin_x + 10, coin_y - 10)], fill=(255, 255, 255, 255), width=7)

    # AWNING STRIPES (alternating pure white & rich emerald)
    num_stripes = 5
    stripe_w = (roof_right_x - roof_left_x) / num_stripes
    for i in range(num_stripes):
        sx0 = roof_left_x + i * stripe_w
        sx1 = sx0 + stripe_w
        # trapezoid stripe
        # top is slightly inset to give 3D perspective
        tx0 = sx0 + 10
        tx1 = sx1 - 10 if i == num_stripes - 1 else sx1
        color = (255, 255, 255, 255) if i % 2 == 0 else (5, 150, 105, 255)
        
        # Scalloped bottom edge
        mid_x = (sx0 + sx1) / 2
        s_draw.polygon([
            (sx0 + 8, roof_top_y),
            (sx1 - 8, roof_top_y),
            (sx1, roof_bot_y - 20),
            (mid_x, roof_bot_y),
            (sx0, roof_bot_y - 20)
        ], fill=color)
        s_draw.ellipse([sx0, roof_bot_y - 40, sx1, roof_bot_y], fill=color)

    # Awning Top Trim Bar
    s_draw.rounded_rectangle([roof_left_x - 15, roof_top_y - 20, roof_right_x + 15, roof_top_y + 8], radius=14, fill=(245, 158, 11, 255))

    # Anti-alias resize to 512x512
    final_icon = icon_img.resize((512, 512), Image.Resampling.LANCZOS)
    final_icon.save('src/assets/tinda-icon.png', 'PNG', optimize=True)
    print("Saved src/assets/tinda-icon.png (512x512)")
    
    # 2. GENERATE FULL BRAND LOGO (512x512 with Emblem + Wordmark)
    logo_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # Place scaled down icon at top center
    icon_scaled = icon_img.resize((480, 480), Image.Resampling.LANCZOS)
    logo_img.paste(icon_scaled, (272, 80), icon_scaled)
    
    l_draw = ImageDraw.Draw(logo_img)
    
    # Draw "TINDA" in large bold emerald lettering
    # Load default or draw geometric bold letters for TINDA
    # We can draw stylized geometric typography:
    # "TINDA" text bar:
    # Since fonts vary by system, we use crisp geometric polygons for 100% vector reproducibility:
    def draw_letter_T(x, y, w, h, color):
        th = 38
        l_draw.rectangle([x, y, x + w, y + th], fill=color)
        l_draw.rectangle([x + (w - th) // 2, y, x + (w + th) // 2, y + h], fill=color)
        
    def draw_letter_I(x, y, w, h, color):
        th = 38
        l_draw.rectangle([x + (w - th) // 2, y, x + (w + th) // 2, y + h], fill=color)
        
    def draw_letter_N(x, y, w, h, color):
        th = 36
        l_draw.rectangle([x, y, x + th, y + h], fill=color)
        l_draw.rectangle([x + w - th, y, x + w, y + h], fill=color)
        l_draw.polygon([(x + th, y), (x + th + 15, y), (x + w, y + h), (x + w - 15, y + h)], fill=color)

    def draw_letter_D(x, y, w, h, color):
        th = 36
        l_draw.rectangle([x, y, x + th, y + h], fill=color)
        l_draw.rounded_rectangle([x + th - 10, y, x + w, y + h], radius=h//2, fill=color)
        l_draw.rounded_rectangle([x + th + 10, y + th, x + w - th, y + h - th], radius=(h - 2*th)//2, fill=(0, 0, 0, 0))

    def draw_letter_A(x, y, w, h, color):
        th = 36
        l_draw.polygon([(x + w//2 - th//2, y), (x + w//2 + th//2, y), (x + w, y + h), (x + w - th, y + h)], fill=color)
        l_draw.polygon([(x + w//2 - th//2, y), (x + w//2 + th//2, y), (x, y + h), (x + th, y + h)], fill=color)
        l_draw.rectangle([x + 18, y + int(h*0.58), x + w - 18, y + int(h*0.58) + 28], fill=color)

    tx = 190
    ty = 610
    tw = 95
    th = 130
    spacing = 135
    tinda_color = (15, 23, 42, 255) # Slate-900 for clean white theme!
    
    draw_letter_T(tx, ty, tw, th, tinda_color)
    draw_letter_I(tx + spacing, ty, 50, th, tinda_color)
    draw_letter_N(tx + spacing + 75, ty, tw, th, tinda_color)
    draw_letter_D(tx + spacing*2 + 75, ty, tw, th, tinda_color)
    draw_letter_A(tx + spacing*3 + 75, ty, tw, th, tinda_color)
    
    # "POS" in a vibrant Emerald Pill Badge
    badge_x0 = 340
    badge_y0 = 780
    badge_x1 = size - 340
    badge_y1 = badge_y0 + 75
    l_draw.rounded_rectangle([badge_x0, badge_y0, badge_x1, badge_y1], radius=38, fill=(16, 185, 129, 255))
    
    # Draw P, O, S in pure white inside the badge
    pw = 42
    ph = 50
    py = badge_y0 + 12
    # P
    px0 = badge_x0 + 70
    l_draw.rectangle([px0, py, px0 + 12, py + ph], fill=(255, 255, 255, 255))
    l_draw.rounded_rectangle([px0, py, px0 + pw, py + 30], radius=15, fill=(255, 255, 255, 255))
    l_draw.rounded_rectangle([px0 + 12, py + 10, px0 + pw - 10, py + 20], radius=5, fill=(16, 185, 129, 255))
    # O
    ox0 = px0 + pw + 35
    l_draw.ellipse([ox0, py, ox0 + pw + 6, py + ph], fill=(255, 255, 255, 255))
    l_draw.ellipse([ox0 + 12, py + 11, ox0 + pw - 6, py + ph - 11], fill=(16, 185, 129, 255))
    # S
    sx0 = ox0 + pw + 40
    l_draw.arc([sx0, py, sx0 + pw, py + 28], 90, 360, fill=(255, 255, 255, 255), width=12)
    l_draw.arc([sx0, py + 22, sx0 + pw, py + ph], 270, 180, fill=(255, 255, 255, 255), width=12)
    l_draw.line([(sx0 + pw - 6, py + 14), (sx0 + pw - 6, py + 24)], fill=(255, 255, 255, 255), width=12)

    # Tagline: "OFFLINE SARI-SARI STORE & RETAIL"
    l_draw.text((310, 890), "OFFLINE SARI-SARI STORE & RETAIL", fill=(100, 116, 139, 255))

    final_logo = logo_img.resize((512, 512), Image.Resampling.LANCZOS)
    final_logo.save('src/assets/tinda-logo.png', 'PNG', optimize=True)
    print("Saved src/assets/tinda-logo.png (512x512)")
    
    # 3. UPDATE ANDROID MIPMAP LAUNCHER ICONS
    mipmaps = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432)
    }
    
    res_base = 'android/app/src/main/res'
    for folder, (ic_size, fg_size) in mipmaps.items():
        folder_path = os.path.join(res_base, folder)
        if os.path.exists(folder_path):
            # Square icon
            sq_icon = icon_img.resize((ic_size, ic_size), Image.Resampling.LANCZOS)
            sq_icon.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
            
            # Round icon
            round_mask = Image.new('L', (ic_size, ic_size), 0)
            rm_draw = ImageDraw.Draw(round_mask)
            rm_draw.ellipse([0, 0, ic_size, ic_size], fill=255)
            round_icon = Image.new('RGBA', (ic_size, ic_size), (0, 0, 0, 0))
            round_icon.paste(sq_icon, (0, 0), round_mask)
            round_icon.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
            
            # Foreground (centered on transparent canvas)
            fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
            scaled_center = icon_img.resize((int(fg_size * 0.72), int(fg_size * 0.72)), Image.Resampling.LANCZOS)
            offset = int((fg_size - (fg_size * 0.72)) / 2)
            fg.paste(scaled_center, (offset, offset), scaled_center)
            fg.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), 'PNG')
            print(f"Updated Android {folder} icons ({ic_size}px / {fg_size}px)")

if __name__ == '__main__':
    create_tinda_brand_assets()
