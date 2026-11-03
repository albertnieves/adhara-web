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
