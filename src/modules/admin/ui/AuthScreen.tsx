import { Logo, Star } from '@/modules/brand';

/** Pantallas de acceso del panel: marca a la izquierda, formulario a la derecha. */
export function AuthScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        data-tone="dark"
        className="bg-night text-ivory grain relative hidden items-center justify-center overflow-hidden lg:flex"
      >
        <Star className="text-gold/10 absolute size-[36rem]" />
        <div className="relative text-center">
          <Logo variant="stacked" className="w-72" />
          <p className="text-fg-muted mt-6 text-xs tracking-[0.3em] uppercase">
            Panel de administración
          </p>
        </div>
      </div>
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-12 lg:hidden">
            <Logo />
          </div>
          <h1 className="mb-8 text-4xl font-light">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border-danger/40 text-danger mb-6 border-l-2 px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}
