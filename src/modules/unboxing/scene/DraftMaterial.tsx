import { useTexture } from '@react-three/drei';
import { useLayoutEffect } from 'react';
import { SRGBColorSpace } from 'three';
import type { MaterialConfig } from '../products/schema';

/**
 * Material con una imagen GENERATED/DRAFT como textura de prueba.
 * La iluminación de la escena se suma a la del draft (lleva sombreado horneado):
 * es aceptable para un prototipo, no para producción.
 */
export function DraftMaterial({
  src,
  config,
  fadeEdges = false,
}: {
  src: string;
  config: MaterialConfig;
  /** Usa el alfa por vértice (bordes fundidos) de la geometría. */
  fadeEdges?: boolean;
}) {
  const tex = useTexture(src);
  useLayoutEffect(() => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <meshStandardMaterial
      map={tex}
      roughness={Math.max(config.roughness, 0.3)}
      // El draft ya lleva brillos horneados: con metalness alto la textura se ve negra.
      metalness={Math.min(config.metalness, 0.25)}
      envMapIntensity={0.4}
      vertexColors={fadeEdges}
      transparent={fadeEdges}
      depthWrite={!fadeEdges}
      polygonOffset
      polygonOffsetFactor={-1}
    />
  );
}
