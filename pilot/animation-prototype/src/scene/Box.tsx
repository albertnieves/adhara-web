import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial, SRGBColorSpace, type Group, type Texture } from 'three';
import { sample, type Timeline } from '../motion/timeline';
import { BOX_FACES, type BoxConfig, type BoxFace } from '../products/schema';
import { makeFaceTemplate } from './boxTemplates';
import type { ProductDims } from './dims';
import { deg } from './units';

type FaceTextures = Partial<Record<BoxFace, Texture>>;
interface LoadedImages {
  color: FaceTextures;
  /** Mapas de estampación (lineales, sin sRGB). */
  foil: FaceTextures;
}
type V3 = [number, number, number];
type Part = 'base' | 'lid';

interface Props {
  box: BoxConfig;
  dims: ProductDims;
  timeline: Timeline;
  /** Formas grises: sin imágenes ni plantillas. */
  grey: boolean;
  greyColor: string;
  /** Muestra plantillas rotuladas en las caras que aún no tienen foto. */
  templates: boolean;
}

/**
 * Caja procedural con tres tipos de apertura (mismos tiempos, S1):
 * - top-flap: fondo + 4 paredes y una solapa superior con bisagra trasera;
 * - lift-lid: base baja y tapa alta que se levanta y se aparta;
 * - hinged-lid: base y tapa con paredes, unidas por una bisagra trasera.
 * Cada cara exterior lleva su imagen (foto del kit u oficial de referencia) o,
 * si falta, el color de la tapa/base o una plantilla. En las cajas con tapa la
 * imagen de una cara lateral se reparte entre base y tapa según `lidFraction`.
 */
export function Box(props: Props) {
  const hasImages = !props.grey && Object.keys(props.box.faces).length > 0;
  return hasImages ? (
    <BoxWithImages {...props} />
  ) : (
    <BoxMesh {...props} images={{ color: {}, foil: {} }} />
  );
}

/** Carga las imágenes de las caras (Suspense) y las pasa a la malla. */
function BoxWithImages(props: Props) {
  const urls = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of BOX_FACES) {
      const img = props.box.faces[f];
      if (img) out[f] = img.src;
      if (img?.foil) out[`${f}:foil`] = img.foil.src;
    }
    return out;
  }, [props.box.faces]);
  const loaded = useTexture(urls) as Record<string, Texture>;
  const images = useMemo<LoadedImages>(() => {
    const color: FaceTextures = {};
    const foil: FaceTextures = {};
    for (const [key, tex] of Object.entries(loaded)) {
      const [face, kind] = key.split(':') as [BoxFace, string | undefined];
      if (kind === 'foil') {
        foil[face] = tex;
      } else {
        // Se marca aquí (antes de crear materiales y clones) para no perder el sRGB.
        tex.colorSpace = SRGBColorSpace;
        color[face] = tex;
      }
      tex.anisotropy = 8;
      tex.needsUpdate = true;
    }
    return { color, foil };
  }, [loaded]);
  return <BoxMesh {...props} images={images} />;
}

function BoxMesh({
  box,
  dims,
  timeline,
  grey,
  greyColor,
  templates,
  images,
}: Props & { images: LoadedImages }) {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const { width: W, height: H, depth: D } = dims.box;
  const t = dims.wall;
  const flap = box.opening === 'top-flap';
  // Altura de la tapa (con paredes) y de la base. La solapa es solo un panel.
  const lidH = flap ? 0 : H * box.lidFraction;
  const baseH = H - lidH;
  /** Parte de la altura (0–1, desde abajo) donde empieza la tapa. */
  const split = baseH / H;

  const mats = useMemo(() => {
    const owned: MeshStandardMaterial[] = [];
    const make = (opts: ConstructorParameters<typeof MeshStandardMaterial>[0]) => {
      const m = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });
      owned.push(m);
      return m;
    };
    const lidPlain = make({ color: grey ? greyColor : box.color });
    const basePlain = make({ color: grey ? greyColor : (box.baseColor ?? box.color) });
    const inside = make({ color: grey ? greyColor : box.insideColor });
    const sizes: Record<BoxFace, [number, number]> = {
      front: [box.widthMm, box.heightMm],
      back: [box.widthMm, box.heightMm],
      left: [box.depthMm, box.heightMm],
      right: [box.depthMm, box.heightMm],
      top: [box.widthMm, box.depthMm],
      bottom: [box.widthMm, box.depthMm],
      inside: [box.widthMm, box.heightMm],
    };
    const source = (f: BoxFace): Texture | undefined => {
      if (grey) return undefined;
      return images.color[f] ?? (templates ? makeFaceTemplate(f, ...sizes[f]) : undefined);
    };
    const cache = new Map<string, MeshStandardMaterial>();
    /** Material de una cara para una parte; en las laterales recorta la franja de la parte. */
    const face = (f: BoxFace, part: Part): MeshStandardMaterial => {
      const key = `${f}:${part}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const tex = source(f);
      let m: MeshStandardMaterial;
      if (!tex) {
        m = f === 'inside' ? inside : part === 'lid' ? lidPlain : basePlain;
      } else {
        const lateral = f !== 'top' && f !== 'bottom';
        const foil = images.foil[f];
        /** En las cajas con tapa, cada parte usa su franja de la imagen de la cara. */
        const band = (src: Texture) => {
          if (!lateral || lidH <= 0) return src;
          const c = src.clone();
          const [v0, v1] = part === 'base' ? [0, split] : [split, 1];
          c.offset.set(0, v0);
          c.repeat.set(1, v1 - v0);
          c.needsUpdate = true;
          return c;
        };
        const orm = foil ? band(foil) : undefined;
        // Estampación: el mapa modula rugosidad (G) y metalicidad (B), con valores base 1.
        // Las fotos ya llevan su luz y su color: se reproducen casi tal cual (emisivo, sin
        // tone mapping) y solo una parte responde a la luz de la escena, para no quemar ni
        // desaturar los tonos (p. ej. el rosa pastel de Yara) y conservar el volumen.
        const map = band(tex);
        const photo = {
          map,
          color: '#707070',
          emissiveMap: map,
          emissive: '#ffffff',
          emissiveIntensity: 0.6,
          envMapIntensity: 0.5,
          toneMapped: false,
        };
        m = make(
          orm
            ? { ...photo, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 }
            : photo,
        );
      }
      cache.set(key, m);
      return m;
    };
    return { owned, face, inside, lidPlain, basePlain };
  }, [box, grey, greyColor, templates, images, lidH, split]);

  useEffect(
    () => () => {
      const all = [...Object.values(images.color), ...Object.values(images.foil)];
      for (const m of mats.owned) {
        // Plantillas y franjas (clones) son propias; las imágenes cargadas las gestiona drei.
        for (const tex of new Set([m.map, m.roughnessMap, m.metalnessMap])) {
          if (tex && !all.includes(tex)) tex.dispose();
        }
        m.dispose();
      }
    },
    [mats, images],
  );

  const bottleH = dims.bottle.height;
  useFrame(() => {
    const s = sample(timeline.spec, timeline.t);
    if (root.current) {
      root.current.position.y = -s.boxDrop * timeline.spec.s2Rise.boxDrop * H;
      root.current.visible = s.boxOpacity > 0.002;
    }
    const g = lid.current;
    if (g) {
      if (box.opening === 'lift-lid') {
        const p = timeline.spec.s1Open.liftLid;
        g.position.set(0, baseH + s.open * p.rise * bottleH, -s.open * s.open * p.back * D);
        g.rotation.x = deg(p.tiltDeg) * s.open;
      } else {
        g.rotation.x = s.flapAngle;
      }
    }
    // El fundido es uno solo para todas las caras.
    const fading = s.boxOpacity < 0.999;
    for (const m of mats.owned) {
      m.opacity = s.boxOpacity;
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.depthWrite = !fading;
        m.needsUpdate = true;
      }
    }
  });

  const { face, inside } = mats;
  // Orden de materiales de BoxGeometry: +x, -x, +y, -y, +z, -z.
  const panel = (size: V3, pos: V3, materials: MeshStandardMaterial[], key?: string) => (
    <mesh key={key} position={pos} material={materials} castShadow>
      <boxGeometry args={size} />
    </mesh>
  );
  const edge = (part: Part) => (part === 'lid' ? mats.lidPlain : mats.basePlain);

  /** Cuatro paredes de altura h, con el borde inferior en y0 y centradas en z = zc. */
  const walls = (part: Part, h: number, y0: number, zc: number) => {
    const e = edge(part);
    const y = y0 + h / 2;
    return [
      panel([W, h, t], [0, y, zc + D / 2 - t / 2], [e, e, e, e, face('front', part), inside], `f${part}`),
      panel([W, h, t], [0, y, zc - D / 2 + t / 2], [e, e, e, e, inside, face('back', part)], `b${part}`),
      panel([t, h, D - 2 * t], [-W / 2 + t / 2, y, zc], [inside, face('left', part), e, e, e, e], `l${part}`),
      panel([t, h, D - 2 * t], [W / 2 - t / 2, y, zc], [face('right', part), inside, e, e, e, e], `r${part}`),
    ];
  };
  const base = edge('base');
  const lidE = edge('lid');

  return (
    <group ref={root} name="box">
      {/* Base: fondo (base por fuera, interior por dentro) y paredes. */}
      {panel([W, t, D], [0, t / 2, 0], [base, base, inside, face('bottom', 'base'), base, base])}
      {walls('base', baseH, 0, 0)}

      {flap && (
        <group ref={lid} position={[0, H, -D / 2]}>
          {/* Solapa: tapa por fuera (+y), interior por dentro (-y). */}
          {panel([W, t, D], [0, t / 2, D / 2], [lidE, lidE, face('top', 'lid'), inside, lidE, lidE])}
          {/* Lengüeta que se mete por dentro de la pared frontal. */}
          {panel([W - 3 * t, D * 0.16, t], [0, -D * 0.08 + t, D - 2 * t], Array(6).fill(inside))}
        </group>
      )}

      {box.opening === 'hinged-lid' && (
        // Bisagra en el canto superior trasero de la base.
        <group ref={lid} position={[0, baseH, -D / 2]}>
          {panel([W, t, D], [0, lidH - t / 2, D / 2], [lidE, lidE, face('top', 'lid'), inside, lidE, lidE])}
          {walls('lid', lidH, 0, D / 2)}
        </group>
      )}

      {box.opening === 'lift-lid' && (
        <group ref={lid} position={[0, baseH, 0]}>
          {panel([W, t, D], [0, lidH - t / 2, 0], [lidE, lidE, face('top', 'lid'), inside, lidE, lidE])}
          {walls('lid', lidH, 0, 0)}
        </group>
      )}
    </group>
  );
}
