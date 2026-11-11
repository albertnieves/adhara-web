import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** prefers-reduced-motion real del sistema. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
  );
}

/** true si el navegador puede crear un contexto WebGL. `?nowebgl` fuerza el fallback. */
export function detectWebGL() {
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    // Solo era para saberlo: se libera para no ocupar uno de los contextos
    // que el navegador permite a la vez.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * WebGL con tarjeta gráfica. Sin ella (SwiftShader, llvmpipe…: navegadores sin
 * GPU, GPU bloqueada o navegadores de pruebas) una escena a pantalla completa
 * va a saltos, así que el carrusel de la portada enseña las fotos.
 * `?nowebgl` fuerza las fotos y `?3d` fuerza la escena (pruebas y capturas).
 */
export function detectHardwareWebGL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('nowebgl')) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    // Libera el contexto de la prueba: el navegador limita cuántos hay.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (params.has('3d')) return true;
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(
      renderer,
    );
  } catch {
    return false;
  }
}

let webgl: boolean | undefined;
const noSubscribe = () => () => {};

/**
 * WebGL disponible, comprobado una vez en el navegador. En el servidor y al
 * hidratar vale false: el botón del 3D aparece después, sin desajustes.
 */
export function useWebGL() {
  return useSyncExternalStore(
    noSubscribe,
    () => (webgl ??= detectWebGL()),
    () => false,
  );
}

let hardware: boolean | undefined;

/**
 * WebGL con tarjeta gráfica (`detectHardwareWebGL`), comprobado una vez en el
 * navegador. En el servidor y al hidratar vale false: el carrusel de la
 * portada decide si trae three.js después, sin desajustes.
 */
export function useHardwareWebGL() {
  return useSyncExternalStore(
    noSubscribe,
    () => (hardware ??= detectHardwareWebGL()),
    () => false,
  );
}
