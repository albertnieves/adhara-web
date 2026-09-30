import { Component, type ReactNode } from 'react';

/** Si la escena 3D falla, se muestra el fallback: la compra nunca depende del 3D. */
export class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('[unboxing] fallo de la escena 3D, se usa la imagen', error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
