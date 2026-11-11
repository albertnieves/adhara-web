/**
 * Comprueba que los primeros bytes de un archivo son de verdad del formato de
 * imagen que dice el navegador (DECISIONS §187). El tipo que llega con la
 * subida lo pone quien sube: sin esto, un HTML o un SVG con script llamado
 * «foto.png» acabaría en el bucket público.
 */

export const IMAGE_SIGNATURE_BYTES = 64;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const startsWith = (bytes: Uint8Array, prefix: readonly number[]) =>
  prefix.every((byte, index) => bytes[index] === byte);

/** AVIF: caja ftyp con la marca avif o avis (principal o compatible). */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return false;
  const size =
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>>
    0;
  const end = Math.min(size, bytes.length);
  // Marca principal (8), versión (12) y marcas compatibles desde 16.
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue;
    const brand = ascii(bytes, offset, 4);
    if (brand === 'avif' || brand === 'avis') return true;
  }
  return false;
}

/** true si los bytes iniciales corresponden al tipo MIME declarado. */
export function matchesImageType(bytes: Uint8Array, type: string): boolean {
  switch (type) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case 'image/webp':
      return (
        bytes.length >= 12 &&
        ascii(bytes, 0, 4) === 'RIFF' &&
        ascii(bytes, 8, 4) === 'WEBP'
      );
    case 'image/avif':
      return isAvif(bytes);
    default:
      return false;
  }
}

/** Lee el principio de un archivo subido y lo compara con su tipo. */
export async function isGenuineImage(file: Blob): Promise<boolean> {
  const head = new Uint8Array(
    await file.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer(),
  );
  return matchesImageType(head, file.type);
}
