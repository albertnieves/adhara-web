import type { MaterialConfig, ProductConfig } from '../products/schema';

export type BottleMaterials = ProductConfig['materials'];

/** Paleta de «formas grises»: solo volumen y movimiento, sin color, vidrio ni texturas. */
export const GREY: Required<BottleMaterials> = {
  body: { color: '#9d9d9b', roughness: 0.55, metalness: 0 },
  cap: { color: '#7e7e7c', roughness: 0.5, metalness: 0 },
  accent: { color: '#c6c6c3', roughness: 0.35, metalness: 0 },
  liquid: { color: '#8a8a88', roughness: 0.5, metalness: 0 },
};
export const GREY_BOX = '#d6d2cb';

export function PbrMaterial({ config }: { config: MaterialConfig }) {
  if (config.transmission !== undefined && config.transmission > 0) {
    return (
      <meshPhysicalMaterial
        color={config.color}
        roughness={config.roughness}
        metalness={config.metalness}
        transmission={config.transmission}
        ior={config.ior ?? 1.5}
        // La geometría está en mm (el grupo escala a unidades): thickness va en mm.
        thickness={config.thicknessMm ?? 5}
        clearcoat={config.clearcoat ?? 0}
      />
    );
  }
  return (
    <meshStandardMaterial
      color={config.color}
      roughness={config.roughness}
      metalness={config.metalness}
    />
  );
}
