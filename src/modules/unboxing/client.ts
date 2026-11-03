'use client';

/*
 * Lo que la ficha usa en el navegador antes de tener la escena: saber si hay
 * WebGL y traer el visor. Va aparte de index.ts, que también lee el servidor.
 */
export { useWebGL } from './env';

/**
 * Trae el visor 3D (three.js y la escena, en su propio trozo de JavaScript).
 * Se llama al pulsar «Abrir la caja en 3D», o al acercarse a él, para que
 * llegue antes; el navegador lo descarga una sola vez.
 */
export function loadUnboxingViewer() {
  return import('./UnboxingViewer');
}
