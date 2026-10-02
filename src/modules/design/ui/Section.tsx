import type { ReactNode } from 'react';
import type { Token } from '../domain/tokens';
import { TokenValue } from './TokenValue';

/** Sección de la página de referencia, con ancla para el índice. */
export function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="border-border mt-16 scroll-mt-8 border-t pt-10"
    >
      <h2 id={`${id}-titulo`} className="text-4xl font-light">
        {title}
      </h2>
      <p className="text-fg-muted mt-3 max-w-3xl text-sm">{intro}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="mt-12 mb-5 text-2xl font-light">{children}</h3>;
}

/** Variable, valor calculado y uso; `sample` dibuja una muestra opcional. */
export function TokenList({
  tokens,
  sample,
}: {
  tokens: readonly Token[];
  sample?: (token: Token) => ReactNode;
}) {
  return (
    <dl className="divide-border border-border divide-y border-y">
      {tokens.map((token) => (
        <div
          key={token.variable}
          className="grid gap-2 py-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-8"
        >
          <dt className="flex flex-col gap-1">
            <code className="text-sm">{token.variable}</code>
            <TokenValue variable={token.variable} />
          </dt>
          <dd className="flex min-w-0 flex-col gap-3">
            <p className="text-fg-muted text-sm">{token.role}</p>
            {sample?.(token)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
