"""Cuts the heads out of assets/cast/*.jpg (background removed with rembg's human-segmentation
model) and writes src/generated/faces.ts: transparent WebP data URIs plus a sampled skin tone,
used as the faces of the shop characters.
The heads get a painted "game portrait" look (OpenCV stylization + bold outline), and the
script measures where the neck is so the app can seat every head on its body the same way.
Needs: pip install rembg onnxruntime opencv-python-headless pillow (model downloads on first run).
Usage: python3 scripts/build-faces.py [--sheet out.png]"""
import base64, io, json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageStat
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Face boxes (x, y, w, h) in each source photo; detected with OpenCV's frontal-face cascade,
# 'dor' set by hand (eyes closed + microphone in front of the face).
FACES = {
    'assaf': (346, 206, 201, 201),
    'yonatan': (67, 81, 215, 215),
    'noam': (138, 64, 102, 102),
    'tzach': (204, 82, 126, 126),
    'chen': (129, 55, 170, 170),
    'matan': (199, 56, 151, 151),
    'dor': (112, 150, 185, 185),
    'tal': (206, 49, 139, 139),
    'noam-future': (30, 70, 177, 177),
}
OUT_W, OUT_H = 240, 288  # head + hair, 5:6
SESSION = None

def toon(rgb, alpha):
    """Painted cel look: edge-preserving stylization, a little extra colour, and a dark outline."""
    img = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
    big = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    st = cv2.resize(cv2.stylization(big, sigma_s=25, sigma_r=0.32), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(st, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 1.15
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.06 + 6, 0, 255)
    out = cv2.cvtColor(hsv.clip(0, 255).astype(np.uint8), cv2.COLOR_HSV2RGB)
    m = (alpha > 110).astype(np.uint8)
    ring = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) - m
    rgba = np.dstack([out, alpha])
    rgba[ring > 0] = [18, 14, 22, 255]
    return rgba


def neck_of(alpha, face):
    """Follow the silhouette down from the chin and take its narrowest point: that's the neck."""
    fx, fy, fw, fh = face
    center = fx + fw / 2
    best = None
    for r in range(int(fy + fh * 0.85), min(alpha.shape[0] - 1, int(fy + fh * 1.5))):
        on = alpha[r] > 128
        c = int(round(center))
        if not on[min(max(c, 0), len(on) - 1)]:
            near = np.where(on)[0]
            if not len(near):
                continue
            c = int(near[np.argmin(np.abs(near - center))])
        left = c
        while left > 0 and on[left - 1]:
            left -= 1
        right = c
        while right < len(on) - 1 and on[right + 1]:
            right += 1
        center = (left + right) / 2
        width = right - left
        if width > fw * 0.25 and (best is None or width < best[0]):
            best = (width, r, center)
    if best is None:
        return fx + fw / 2, fy + fh * 1.1
    return best[2], best[1]


def cut(name):
    global SESSION
    SESSION = SESSION or new_session('u2net_human_seg')
    im = Image.open(os.path.join(ROOT, 'assets/cast', name + '.jpg')).convert('RGB')
    person = remove(im, session=SESSION, post_process_mask=True)
    x, y, w, h = FACES[name]
    skin = ImageStat.Stat(im.crop((int(x + w * 0.3), int(y + h * 0.45), int(x + w * 0.7), int(y + h * 0.62)))).median
    cx, cy = x + w / 2, y + h / 2 - 0.12 * h
    cw, ch = w * 1.55, w * 1.55 * OUT_H / OUT_W
    box = tuple(int(round(v)) for v in (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
    crop = person.crop(box).resize((OUT_W, OUT_H), Image.LANCZOS)
    sx, sy = OUT_W / (box[2] - box[0]), OUT_H / (box[3] - box[1])
    face = ((x - box[0]) * sx, (y - box[1]) * sy, w * sx, h * sy)
    alpha = np.array(crop.getchannel('A'))
    nx, ny = neck_of(alpha, face)
    # Fade everything below the neck: the illustrated body takes over from there.
    rows = np.arange(OUT_H, dtype=np.float32)[:, None]
    fade = np.clip(1 - (rows - (ny + 6)) / 14, 0, 1)
    # Keep only the head: a soft oval around the face (drops shoulders, mics and arms beside it).
    yy, xx = np.mgrid[0:OUT_H, 0:OUT_W].astype(np.float32)
    fcx, fcy = face[0] + face[2] / 2, face[1] + face[3] * 0.42
    oval = ((xx - fcx) / (face[2] * 0.78)) ** 2 + ((yy - fcy) / (face[3] * 1.02)) ** 2
    keep = np.clip((1.12 - oval) / 0.12, 0, 1)
    alpha = (alpha * keep).astype(np.uint8)
    # Drop floating bits (a hand or mic cut off by the oval): keep the largest connected piece.
    n, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 40).astype(np.uint8))
    if n > 2:
        main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        alpha[(labels != main) & (labels != 0)] = 0
    rgba = toon(crop.convert('RGB'), alpha)
    rgba[..., 3] = (rgba[..., 3] * fade).astype(np.uint8)
    geo = {'neckX': round(nx / OUT_W, 4), 'neckY': round(ny / OUT_H, 4), 'faceW': round(face[2] / OUT_W, 4)}
    return Image.fromarray(rgba), '#%02x%02x%02x' % tuple(int(c) for c in skin[:3]), geo


def main():
    faces = {n: cut(n) for n in FACES}
    out, tones, geos = {}, {}, {}
    for n, (img, tone, geo) in faces.items():
        geos[n] = geo
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=84, method=6)
        out[n] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
        tones[n] = tone
    path = os.path.join(ROOT, 'src/generated/faces.ts')
    with open(path, 'w') as f:
        f.write('// Generated by scripts/build-faces.py from assets/cast — do not edit.\n')
        f.write('export const FACE_TONES: Record<string, string> = ' + json.dumps(tones) + ';\n')
        f.write('/** Neck point and face width, as fractions of the image. */\n')
        f.write('export const FACE_GEO: Record<string, { neckX: number; neckY: number; faceW: number }> = ' + json.dumps(geos) + ';\n')
        f.write('export const FACES: Record<string, string> = ' + json.dumps(out, indent=1) + ';\n')
    print('faces.ts', round(os.path.getsize(path) / 1024), 'KB')
    if '--sheet' in sys.argv:
        from PIL import ImageDraw
        sheet = Image.new('RGBA', (OUT_W * len(faces), OUT_H), (40, 30, 60, 255))
        d = ImageDraw.Draw(sheet)
        for i, (img, _, g) in enumerate(faces.values()):
            sheet.alpha_composite(img, (i * OUT_W, 0))
            x, y = i * OUT_W + g['neckX'] * OUT_W, g['neckY'] * OUT_H
            d.ellipse((x - 5, y - 5, x + 5, y + 5), outline=(0, 255, 120, 255), width=2)
        sheet.save(sys.argv[sys.argv.index('--sheet') + 1])

main()
