"""Tarjeta de visita de L’Atelier du Désert (docs/brand/tarjetas/README.md).

Genera, en docs/brand/tarjetas/:
- tarjeta-visita.pdf: archivo de imprenta, 2 páginas (anverso y reverso) de
  61 × 91 mm (55 × 85 mm más 3 mm de sangrado), textos en curvas y cajas
  TrimBox y BleedBox;
- tarjeta-visita-anverso.png y tarjeta-visita-reverso.png: vistas al corte;
- tarjeta-visita-maqueta.jpg: las dos caras sobre arena, para enseñarla;
- qr-catalogo.svg: el QR suelto, con su margen de silencio.

Uso (Python 3.12+, desde la raíz del repositorio):
    python3 -m venv /tmp/tarjeta && /tmp/tarjeta/bin/pip install -r docs/brand/tarjetas/generar/requirements.txt
    /tmp/tarjeta/bin/python docs/brand/tarjetas/generar/tarjeta.py

Usa el Chromium de Playwright (PLAYWRIGHT_CHROMIUM o /opt/pw-browsers/chromium)
y descarga las tipografías de google/fonts (OFL) a una caché temporal.
Al terminar, lee el QR de la imagen del reverso y falla si no da la URL.
"""

import math
import os
import re
import tempfile
import urllib.request
from pathlib import Path

import segno
import uharfbuzz as hb
import zxingcpp
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from playwright.sync_api import sync_playwright
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

# --- Datos. Solo datos reales (CLAUDE.md, «Nunca inventar»). -----------------

# Redirige al catálogo en el idioma del navegador (es, ca o en).
QR_URL = 'https://latelierdudesert.com/catalogo'
WEB = 'latelierdudesert.com'
# Líneas de contacto del reverso: (texto, tono). Máximo 4. El teléfono y el
# Instagram se añaden aquí cuando estén en Panel → Configuración.
CONTACT = [
    ('Carrer de Pompeu Fabra, 1', 'muted'),
    ('08860 Castelldefels · Barcelona', 'muted'),
    ('latelierdudesert@gmail.com', 'soft'),
]
CITY = 'CASTELLDEFELS'
CATALOGUE = 'Catálogo · Catàleg · Catalogue'

# --- Paleta (src/app/globals.css) ----------------------------------------------

IVORY = '#f5f1ea'
INK = '#151311'
INK_SOFT = '#2e2925'
SMOKE = '#6b645b'
GOLD = '#a8844f'
GOLD_SOFT = '#d6bf98'
OUD = '#2a1d15'
TONES = {'muted': SMOKE, 'soft': INK_SOFT}

# --- Geometría en mm: página con sangrado y corte en x 3–58, y 3–88. -------------

PAGE_W, PAGE_H, BLEED = 61, 91, 3
CX = PAGE_W / 2
PT = 25.4 / 72  # 1 pt en mm

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parents[1]
LOGO = ROOT / 'public/brand/logo.svg'
STAR_TSX = ROOT / 'src/modules/brand/Star.tsx'

FONT_BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
FONTS = {
    'serif': 'cormorantgaramond/CormorantGaramond[wght].ttf',
    'serif-italic': 'cormorantgaramond/CormorantGaramond-Italic[wght].ttf',
    'sans': 'manrope/Manrope[wght].ttf',
}


def num(v):
    return f'{round(v, 3):g}'


# --- QR ---------------------------------------------------------------------------

QR_DOT_R = 0.45  # radio de cada punto, en módulos
QR_EYE_R = 0.45  # redondeo de los ojos (más redondo, peor lo leen algunos lectores)
QR_CLEAR_R = 3.3  # hueco central para la estrella, en módulos
QR_STAR_H = 6.2  # alto de la estrella central, en módulos


def rrect(x, y, w, h, r):
    return (
        f'M{num(x + r)} {num(y)}h{num(w - 2 * r)}a{num(r)} {num(r)} 0 0 1 {num(r)} {num(r)}'
        f'v{num(h - 2 * r)}a{num(r)} {num(r)} 0 0 1 {num(-r)} {num(r)}h{num(-(w - 2 * r))}'
        f'a{num(r)} {num(r)} 0 0 1 {num(-r)} {num(-r)}v{num(-(h - 2 * r))}'
        f'a{num(r)} {num(r)} 0 0 1 {num(r)} {num(-r)}z'
    )


def qr_paths(star_d):
    """Puntos, ojos y estrella del QR en unidades de módulo (0..n)."""
    qr = segno.make_qr(QR_URL, error='h', boost_error=False)
    assert qr.designator == '5-H', qr.designator
    m = [list(row) for row in qr.matrix]
    n = len(m)
    c = n / 2
    eyes = [(0, 0), (n - 7, 0), (0, n - 7)]
    align = (n - 9, n - 9)

    def in_box(x, y, bx, by, size):
        return bx <= x < bx + size and by <= y < by + size

    dots = []
    for y in range(n):
        for x in range(n):
            if not m[y][x]:
                continue
            if any(in_box(x, y, ex, ey, 7) for ex, ey in eyes):
                continue
            if in_box(x, y, *align, 5):
                continue
            if (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= QR_CLEAR_R**2:
                continue
            r, d = QR_DOT_R, 2 * QR_DOT_R
            dots.append(
                f'M{num(x + 0.5 - r)} {num(y + 0.5)}a{num(r)} {num(r)} 0 1 0 {num(d)} 0'
                f'a{num(r)} {num(r)} 0 1 0 {num(-d)} 0z'
            )
    eye_d = ''
    for ex, ey in eyes:
        eye_d += rrect(ex, ey, 7, 7, QR_EYE_R) + rrect(ex + 1, ey + 1, 5, 5, 0.01)
        eye_d += rrect(ex + 2, ey + 2, 3, 3, QR_EYE_R / 2.3)
    ax, ay = align
    eye_d += rrect(ax, ay, 5, 5, QR_EYE_R) + rrect(ax + 1, ay + 1, 3, 3, 0.01)
    eye_d += f'M{ax + 2} {ay + 2.5}a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0z'

    s = QR_STAR_H / 23.3  # la estrella mide 23,3 de alto en su caja de 24
    star = (
        f'<path fill="{GOLD}" transform="translate({num(c - 12 * s)} {num(c - 12 * s)}) '
        f'scale({num(s)})" d="{star_d}"/>'
    )
    body = (
        f'<path fill="{INK}" fill-rule="evenodd" d="{eye_d}"/>'
        f'<path fill="{INK}" d="{"".join(dots)}"/>{star}'
    )
    return n, body


# --- Texto en curvas ------------------------------------------------------------


def font_file(key):
    cache = Path(tempfile.gettempdir()) / 'atelier-fuentes'
    cache.mkdir(exist_ok=True)
    path = cache / Path(FONTS[key]).name
    if not path.exists():
        url = FONT_BASE + FONTS[key].replace('[', '%5B').replace(']', '%5D')
        urllib.request.urlretrieve(url, path)
    return path


_FACES = {}


def text_path(text, *, font, weight, size, x, y, fill, tracking=0.0, anchor='middle'):
    """Compone el texto con HarfBuzz (kerning y ligaduras) y lo devuelve como
    trazado SVG en mm. `size` es el cuerpo en mm; `tracking`, el espacio
    añadido entre letras en mm (sin contar tras la última)."""
    if font not in _FACES:
        _FACES[font] = hb.Face(font_file(font).read_bytes())
    face = _FACES[font]
    hb_font = hb.Font(face)
    hb_font.set_variations({'wght': weight})
    upem = face.upem
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {'kern': True, 'liga': True})
    scale = size / upem
    track = tracking / scale
    advances = [p.x_advance for p in buf.glyph_positions]
    width = sum(advances) + track * (len(advances) - 1)
    x0 = x - (width * scale / 2 if anchor == 'middle' else 0)

    pen = SVGPathPen(None, ntos=lambda v: f'{round(v, 3):g}')
    pen_x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gx = x0 + (pen_x + pos.x_offset) * scale
        gy = y - pos.y_offset * scale
        hb_font.draw_glyph_with_pen(info.codepoint, TransformPen(pen, (scale, 0, 0, -scale, gx, gy)))
        pen_x += pos.x_advance + track
    return f'<path fill="{fill}" d="{pen.getCommands()}"><title>{text}</title></path>'


def pt(v):
    return v * PT


# --- Caras ------------------------------------------------------------------------


def arch(cx, top, r, bottom, gap, closed):
    """Arco de medio punto con un hueco en la clave para la estrella."""
    t = math.asin(gap / r)
    yc = top + r
    lx, rx = cx - r * math.sin(t), cx + r * math.sin(t)
    ky = yc - r * math.cos(t)
    left = f'M{num(lx)} {num(ky)}A{r} {r} 0 0 0 {num(cx - r)} {num(yc)}V{bottom}'
    if closed:
        return left + f'H{num(cx + r)}V{num(yc)}A{r} {r} 0 0 0 {num(rx)} {num(ky)}'
    return left + f'M{num(cx + r)} {bottom}V{num(yc)}A{r} {r} 0 0 0 {num(rx)} {num(ky)}'


def star_use(cx, cy, h, fill, opacity=1):
    side = h * 24 / 23.3
    op = f' opacity="{opacity}"' if opacity != 1 else ''
    return (
        f'<use href="#star" x="{num(cx - side / 2)}" y="{num(cy - side / 2)}" '
        f'width="{num(side)}" height="{num(side)}" fill="{fill}"{op}/>'
    )


def front():
    """Anverso, la noche: el arco (la puerta del atelier) sube desde el borde
    inferior y enmarca el logotipo en marfil. Estrellas sueltas, como el cielo
    del emblema."""
    parts = [
        f'<rect width="{PAGE_W}" height="{PAGE_H}" fill="url(#night)"/>',
        star_use(7.0, 10.0, 1.6, GOLD_SOFT, 0.75),
        star_use(9.05, 15.85, 0.9, GOLD_SOFT, 0.5),
        star_use(52.2, 13.2, 1.2, GOLD_SOFT, 0.6),
        star_use(53.8, 22.2, 0.8, GOLD_SOFT, 0.45),
        f'<path d="{arch(CX, 11, 20, PAGE_H, 2.2, False)}" fill="none" stroke="{GOLD}" stroke-width="0.22"/>',
        star_use(CX, 11, 2.8, GOLD),
        # Lockup del sprite sin cambios: un solo color, marfil sobre oscuro.
        f'<use href="#lockup" x="15" y="29.5" width="31" height="{num(31 * 839 / 834)}" fill="{IVORY}"/>',
        text_path(CITY, font='sans', weight=500, size=pt(5.5), x=CX, y=75, fill=GOLD_SOFT, tracking=0.58),
    ]
    return parts


def back(qr_n, qr_body):
    """Reverso, el día: el mismo arco, cerrado, enmarca el QR al catálogo."""
    qr_size = 24
    qr_x, qr_y = CX - qr_size / 2, 31
    module = qr_size / qr_n
    n = len(CONTACT)
    assert 1 <= n <= 4, 'El reverso admite de 1 a 4 líneas de contacto.'
    step = 3.2
    first = 77.5 - step * (n - 1) / 2
    parts = [
        f'<rect width="{PAGE_W}" height="{PAGE_H}" fill="{IVORY}"/>',
        text_path(CATALOGUE, font='serif-italic', weight=400, size=2.9, x=CX, y=11.4, fill=SMOKE),
        f'<path d="{arch(CX, 16, 17, 60, 1.9, True)}" fill="none" stroke="{GOLD}" stroke-width="0.22"/>',
        star_use(CX, 16, 2.4, GOLD),
        f'<g transform="translate({num(qr_x)} {num(qr_y)}) scale({num(module)})">{qr_body}</g>',
        text_path(WEB, font='serif', weight=500, size=3.7, x=CX, y=67, fill=INK),
        f'<rect x="{num(CX - 2.5)}" y="69.6" width="5" height="0.15" fill="{GOLD}"/>',
    ]
    for i, (line, tone) in enumerate(CONTACT):
        y = first + i * step + (0.6 if tone == 'soft' and i > 0 and CONTACT[i - 1][1] != 'soft' else 0)
        parts.append(text_path(line, font='sans', weight=400, size=2.2, x=CX, y=y, fill=TONES[tone]))
    return parts


def document(star_d, lockup):
    qr_n, qr_body = qr_paths(star_d)
    defs = (
        f'<symbol id="lockup" viewBox="354 91 834 839">{lockup}</symbol>'
        f'<symbol id="star" viewBox="0 0 24 24"><path d="{star_d}"/></symbol>'
        '<radialGradient id="night" cx="50%" cy="40%" r="75%">'
        f'<stop offset="0" stop-color="#3a281c"/><stop offset="0.55" stop-color="{OUD}"/>'
        '<stop offset="1" stop-color="#1e140e"/></radialGradient>'
    )

    def face(parts, label):
        return (
            f'<svg class="face" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE_W} {PAGE_H}" '
            f'width="{PAGE_W}mm" height="{PAGE_H}mm" role="img" aria-label="{label}">'
            f'{"".join(parts)}</svg>'
        )

    html = (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<title>Tarjeta de visita</title><style>'
        f'@page{{size:{PAGE_W}mm {PAGE_H}mm;margin:0}}html,body{{margin:0;padding:0}}'
        '.face{display:block;break-after:page}.face:last-of-type{break-after:auto}'
        '</style></head><body>'
        f'<svg width="0" height="0" style="position:absolute"><defs>{defs}</defs></svg>'
        f'{face(front(), "Anverso")}{face(back(qr_n, qr_body), "Reverso")}'
        '</body></html>'
    )
    standalone_qr = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 {qr_n + 8} {qr_n + 8}" role="img">'
        f'<title>{QR_URL}</title><rect x="-4" y="-4" width="{qr_n + 8}" height="{qr_n + 8}" fill="{IVORY}"/>'
        f'{qr_body}</svg>\n'
    )
    return html, standalone_qr


# --- Render y comprobaciones ------------------------------------------------------


def render(html_path, pdf_path, pngs):
    px = 96 / 25.4
    exe = os.environ.get('PLAYWRIGHT_CHROMIUM', '/opt/pw-browsers/chromium')
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe)
        page = browser.new_page(
            viewport={'width': round(PAGE_W * px) + 1, 'height': round(2 * PAGE_H * px) + 1},
            device_scale_factor=4,
        )
        page.goto(html_path.as_uri())
        page.emulate_media(media='print')
        page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
        for i, png in enumerate(pngs):
            page.screenshot(
                path=str(png),
                clip={
                    'x': BLEED * px,
                    'y': (i * PAGE_H + BLEED) * px,
                    'width': (PAGE_W - 2 * BLEED) * px,
                    'height': (PAGE_H - 2 * BLEED) * px,
                },
            )
        browser.close()


def set_boxes(pdf_path):
    """Medidas exactas y cajas de imprenta. Chromium dibuja desde la esquina
    superior izquierda a 0,75 pt por px y redondea la página hacia arriba."""
    w, h = PAGE_W / PT, PAGE_H / PT
    b = BLEED / PT
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    for page in reader.pages:
        top = float(page.mediabox.top)
        media = RectangleObject([0, top - h, w, top])
        page.mediabox = media
        page.cropbox = media
        page.bleedbox = media
        page.trimbox = RectangleObject([b, top - h + b, w - b, top - b])
        writer.add_page(page)
    writer.add_metadata({'/Title': 'L’Atelier du Désert · Tarjeta de visita'})
    with open(pdf_path, 'wb') as f:
        writer.write(f)
    data = Path(pdf_path).read_bytes()
    assert b'/FontDescriptor' not in data, 'El PDF no debe llevar tipografías: textos en curvas.'


def check_qr(png):
    from PIL import Image

    image = Image.open(png)
    for scale in (1, 0.5, 0.3):
        im = image.resize((int(image.width * scale), int(image.height * scale)))
        texts = [r.text for r in zxingcpp.read_barcodes(im)]
        assert QR_URL in texts, f'El QR no se lee a escala {scale}: {texts}'


def mockup(front_png, back_png, out):
    """Las dos caras sobre un fondo arena con sombra suave (solo para enseñar)."""
    from PIL import Image, ImageDraw, ImageFilter

    w, h = 2000, 1400
    bg = Image.new('RGB', (w, h))
    draw = ImageDraw.Draw(bg)
    for y in range(h):
        t = y / h
        draw.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip((236, 229, 218), (214, 204, 189))))

    def place(png, cx, cy, angle):
        card = Image.open(png).convert('RGB')
        card = card.resize((int(card.width * 0.85), int(card.height * 0.85)), Image.LANCZOS)
        pad = 120
        size = (card.width + 2 * pad, card.height + 2 * pad)
        mask = Image.new('L', size, 0)
        mask.paste(255, (pad, pad, pad + card.width, pad + card.height))
        mask = mask.rotate(angle, resample=Image.BICUBIC, expand=True)
        big = Image.new('RGB', size)
        big.paste(card, (pad, pad))
        big = big.rotate(angle, resample=Image.BICUBIC, expand=True)
        x, y = cx - big.width // 2, cy - big.height // 2
        for blur, (dx, dy), opacity in ((38, (16, 30), 0.38), (6, (3, 5), 0.30)):
            shadow = mask.filter(ImageFilter.GaussianBlur(blur)).point(lambda a: int(a * opacity))
            bg.paste((45, 32, 22), (x + dx, y + dy, x + dx + shadow.width, y + dy + shadow.height), shadow)
        bg.paste(big, (x, y), mask)

    place(front_png, 570, 700, 3)
    place(back_png, 1440, 700, -4)
    bg.save(out, quality=90)


def main():
    sprite = LOGO.read_text()
    lockup = re.search(r'<symbol id="lockup" viewBox="354 91 834 839">(.*?)</symbol>', sprite, re.S)
    star = re.search(r'<path d="([^"]+)"', STAR_TSX.read_text())
    html, standalone_qr = document(star.group(1), lockup.group(1))

    pdf = OUT / 'tarjeta-visita.pdf'
    pngs = [OUT / 'tarjeta-visita-anverso.png', OUT / 'tarjeta-visita-reverso.png']
    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / 'tarjeta.html'
        html_path.write_text(html)
        render(html_path, pdf, pngs)
    set_boxes(pdf)
    (OUT / 'qr-catalogo.svg').write_text(standalone_qr)
    check_qr(pngs[1])
    mockup(*pngs, OUT / 'tarjeta-visita-maqueta.jpg')
    print(f'Listo: {pdf.relative_to(ROOT)}, {len(pngs)} PNG y el QR ({QR_URL}) leído.')


if __name__ == '__main__':
    main()
