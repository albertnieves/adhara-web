import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNBOXING_SCENES, findSceneSlug } from '@/modules/unboxing';
import { HALO_TINTS } from '@/modules/unboxing/carousel/tints';
import { findScene, scenes } from '@/modules/unboxing/products';
import type { ProductConfig } from '@/modules/unboxing/products';

/*
 * Escenas 3D de la ficha (ADR-007, DECISIONS §191): cada slug que el panel deja
 * elegir tiene su configuración, y la textura frontal de cada frasco cae dentro
 * de su imagen, es decir, la calibración en px/mm no se sale de la foto.
 */

/** Alto y medio ancho del frasco en mm, según su molde. */
function bottleBox(p: ProductConfig) {
  const s = p.bottle;
  switch (s.archetype) {
    case 'lathe-shoulder':
      return {
        height: s.bodyHeightMm + s.neckHeightMm + s.capHeightMm,
        halfWidth: Math.max(s.capRadiusMm, s.bodyTopRadiusMm),
      };
    case 'rect-prism':
      return {
        height:
          s.body.heightMm +
          s.collar.heightMm +
          s.neck.heightMm +
          s.cap.heightMm,
        halfWidth: s.body.widthMm / 2,
      };
    case 'square-glass':
      return { height: s.body.heightMm + s.cap.heightMm, halfWidth: 0 };
  }
}

describe('escenas 3D', () => {
  it('cada slug del panel tiene una escena y no sobra ninguna', () => {
    expect(scenes.map((s) => s.slug).sort()).toEqual(
      [...UNBOXING_SCENES].sort(),
    );
    for (const slug of UNBOXING_SCENES) {
      expect(findScene(slug)?.slug).toBe(slug);
      expect(findSceneSlug(slug)).toBe(slug);
      expect(HALO_TINTS[slug]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('las seis escenas nuevas usan fotos oficiales con procedencia', () => {
    const nuevas = [
      'asad-bourbon',
      'asad-elixir',
      'yara-elixir',
      'yara-moi',
      'club-de-nuit-intense',
      'club-de-nuit-iconic',
    ];
    for (const slug of nuevas) {
      const p = findScene(slug);
      expect(p?.measurements.estimated).toBe(true);
      expect(p?.frontTexture?.origin).toBe('OFFICIAL');
      expect(p?.frontTexture?.sourceUrl).toMatch(/^https:\/\//);
      expect(existsSync(p?.frontTexture?.file ?? '')).toBe(true);
      for (const face of Object.values(p?.box.faces ?? {})) {
        expect(existsSync(face.file)).toBe(true);
        if (face.foil) expect(existsSync(face.foil.file)).toBe(true);
      }
    }
  });

  it('el frasco proyectado cabe en su imagen frontal', () => {
    for (const p of scenes) {
      const t = p.frontTexture;
      if (!t) continue;
      const { height, halfWidth } = bottleBox(p);
      const left = t.centerXPx - halfWidth * t.pxPerMm;
      const right = t.centerXPx + halfWidth * t.pxPerMm;
      const top = t.baseYPx - height * t.pxPerMm;
      expect(left, p.slug).toBeGreaterThanOrEqual(0);
      expect(right, p.slug).toBeLessThanOrEqual(t.widthPx);
      expect(top, p.slug).toBeGreaterThanOrEqual(0);
      expect(t.baseYPx, p.slug).toBeLessThanOrEqual(t.heightPx);
    }
  });

  it('la caja tiene sitio para el frasco de pie', () => {
    for (const p of scenes) {
      if (p.box.bottlePose !== 'standing') continue;
      const { height, halfWidth } = bottleBox(p);
      expect(p.box.heightMm, p.slug).toBeGreaterThan(height);
      expect(p.box.widthMm, p.slug).toBeGreaterThan(2 * halfWidth);
    }
  });
});
