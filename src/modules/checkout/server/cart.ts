import 'server-only';
import { cookies } from 'next/headers';
import type { CartLine } from '../domain/cart';
import {
  CART_COOKIE,
  CART_MAX_AGE,
  parseCart,
  serializeCart,
} from '../domain/cart';

/** La cesta de quien visita (cookie técnica, sin datos personales). */
export async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

/** Solo en acciones del servidor: guarda la cesta o la borra si queda vacía. */
export async function writeCart(lines: readonly CartLine[]) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(lines), {
    path: '/',
    maxAge: CART_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // La cabecera lee el número de artículos en el navegador.
    httpOnly: false,
  });
}
