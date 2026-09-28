import type { MaterialConfig } from '../products/schema';
import { MM } from './units';

/** Paleta de «formas grises»: solo volumen y movimiento, sin color ni texturas. */
export const GREY = {
  body: { color: '#9d9d9b', roughness: 0.55, metalness: 0 },
  cap: { color: '#7e7e7c', roughness: 0.5, metalness: 0 },
  accent: { color: '#c6c6c3', roughness: 0.35, metalness: 0 },
  box: '#d6d2cb',
} as const satisfies Record<string, MaterialConfig | string>;

export function PbrMaterial({ config }: { config: MaterialConfig }) {
  if (config.transmission !== undefined && config.transmission > 0) {
    return (
      <meshPhysicalMaterial
        color={config.color}
        roughness={config.roughness}
        metalness={config.metalness}
        transmission={config.transmission}
        ior={config.ior ?? 1.5}
        thickness={(config.thicknessMm ?? 5) * MM}
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
