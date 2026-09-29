import { CanvasTexture, SRGBColorSpace } from 'three';
import type { BoxFace } from '../products/schema';

export const FACE_LABEL: Record<BoxFace, string> = {
  front: 'FRONTAL',
  back: 'TRASERA',
  left: 'LATERAL IZQ.',
  right: 'LATERAL DER.',
  top: 'TAPA',
  bottom: 'BASE',
  inside: 'INTERIOR',
};

/**
 * Plantilla neutra rotulada para comprobar el mapeo de cada cara (orientación,
 * proporción, qué cara es cuál). NO es arte de producto: se sustituye por las
 * fotos del kit de tienda.
 */
export function makeFaceTemplate(face: BoxFace, widthMm: number, heightMm: number) {
  const long = 512;
  const w = Math.round(widthMm >= heightMm ? long : (long * widthMm) / heightMm);
  const h = Math.round(heightMm >= widthMm ? long : (long * heightMm) / widthMm);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  ctx.fillStyle = '#efe9df';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#9a8f80';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.setLineDash([]);

  const unit = Math.min(w, h);
  ctx.fillStyle = '#4b443b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(unit * 0.13)}px system-ui, sans-serif`;
  ctx.fillText(FACE_LABEL[face], w / 2, h / 2);
  ctx.font = `${Math.round(unit * 0.065)}px system-ui, sans-serif`;
  ctx.fillText(`${Math.round(widthMm)} × ${Math.round(heightMm)} mm`, w / 2, h / 2 + unit * 0.13);
  ctx.fillText('↑ arriba', w / 2, 16 + unit * 0.07);
  ctx.fillStyle = '#b4412f';
  ctx.fillText('PLANTILLA · no es arte real', w / 2, h - 16 - unit * 0.07);
  // Esquina de referencia: sup.-izq. (detecta caras reflejadas).
  ctx.fillStyle = '#b4412f';
  ctx.fillRect(14, 14, unit * 0.06, unit * 0.06);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
