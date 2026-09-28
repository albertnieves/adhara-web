import { ContactShadows, Environment, Lightformer } from '@react-three/drei';

/**
 * Luz de estudio común a todos los productos. El Environment se genera con
 * Lightformers procedurales (sin descargar HDRI): ligero y sin red.
 */
export function Stage({ shadowScale }: { shadowScale: number }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d9d2c7', 0.55]} />
      <directionalLight position={[2.5, 5, 3.5]} intensity={1.1} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 3]} scale={[8, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 1.5, 1]} scale={[1.2, 6, 1]} target={[0, 1, 0]} />
        <Lightformer form="rect" intensity={1.0} position={[5, 1.5, -1]} scale={[1.2, 6, 1]} target={[0, 1, 0]} />
        <Lightformer form="circle" intensity={0.6} position={[0, -3, 2]} scale={4} target={[0, 0, 0]} />
      </Environment>
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.32}
        scale={shadowScale}
        blur={2.8}
        far={shadowScale}
        resolution={512}
        color="#4a4036"
      />
    </>
  );
}
