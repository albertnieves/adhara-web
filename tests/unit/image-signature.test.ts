import { describe, expect, it } from 'vitest';
import { isGenuineImage, matchesImageType } from '@/lib/image-signature';

/*
 * Subidas del panel (DECISIONS §187): el tipo lo declara el navegador de
 * quien sube, así que se comprueban los primeros bytes del archivo.
 */

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], 'JFIF');
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0]);
const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 ');
const AVIF = bytes([0, 0, 0, 0x1c], 'ftypavif', [0, 0, 0, 0], 'avifmif1miaf');
// Marca principal mif1 y avif entre las compatibles (otros codificadores).
const AVIF_COMPATIBLE = bytes(
  [0, 0, 0, 0x18],
  'ftypmif1',
  [0, 0, 0, 0],
  'avif',
);
const HEIC = bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0], 'mif1');
const HTML = bytes('<!doctype html><script>alert(1)</script>');
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">');

describe('firma de las imágenes subidas', () => {
  it('acepta cada formato con sus bytes', () => {
    expect(matchesImageType(JPEG, 'image/jpeg')).toBe(true);
    expect(matchesImageType(PNG, 'image/png')).toBe(true);
    expect(matchesImageType(WEBP, 'image/webp')).toBe(true);
    expect(matchesImageType(AVIF, 'image/avif')).toBe(true);
    expect(matchesImageType(AVIF_COMPATIBLE, 'image/avif')).toBe(true);
  });

  it('rechaza un archivo que no es lo que dice', () => {
    expect(matchesImageType(HTML, 'image/png')).toBe(false);
    expect(matchesImageType(SVG, 'image/jpeg')).toBe(false);
    expect(matchesImageType(PNG, 'image/jpeg')).toBe(false);
    expect(matchesImageType(HEIC, 'image/avif')).toBe(false);
    expect(matchesImageType(new Uint8Array(), 'image/webp')).toBe(false);
    expect(matchesImageType(SVG, 'image/svg+xml')).toBe(false);
  });

  it('lee el principio del archivo subido', async () => {
    expect(
      await isGenuineImage(new File([PNG], 'foto.png', { type: 'image/png' })),
    ).toBe(true);
    expect(
      await isGenuineImage(new File([HTML], 'foto.png', { type: 'image/png' })),
    ).toBe(false);
  });
});
