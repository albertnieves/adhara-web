import type { CSSProperties, ReactNode } from 'react';

/**
 * Aparece al entrar en pantalla: sube y se funde, una sola vez. Lo hace CSS
 * con el guion de RevealScript, que corre mientras llega la página: lo que ya
 * está en pantalla aparece con el primer pintado, sin esperar a React
 * (DECISIONS §190). Sin ese guion (sin JavaScript, en el panel) o con
 * movimiento reducido, se ve directamente.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'li' | 'section';
}) {
  const style = {
    ...(delay ? { '--reveal-delay': `${delay}s` } : {}),
    ...(y !== 28 ? { '--reveal-y': `${y}px` } : {}),
  } as CSSProperties;
  return (
    <Tag
      data-reveal=""
      className={className}
      style={style}
      // El guion marca data-revealed antes de hidratar: no es un desajuste.
      suppressHydrationWarning
    >
      {children}
    </Tag>
  );
}

/*
 * Oculta los [data-reveal] (solo si el navegador puede observarlos y no se
 * pide movimiento reducido) y los marca con data-revealed al entrar en
 * pantalla, también los que añade React al navegar. ES5 a propósito: corre
 * antes que el resto del JavaScript.
 */
const SCRIPT = `(function(){
if(!('IntersectionObserver' in window)||!window.matchMedia)return;
var s=document.createElement('style');
s.textContent='@media (prefers-reduced-motion: no-preference){[data-reveal]:not([data-revealed]){opacity:0;transform:translateY(var(--reveal-y,28px))}}';
document.head.appendChild(s);
var seen=new WeakSet(),queued=false;
var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-revealed','');io.unobserve(e.target);}});},{rootMargin:'0px 0px -10% 0px'});
function scan(){queued=false;document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach(function(el){if(!seen.has(el)){seen.add(el);io.observe(el);}});}
scan();
new MutationObserver(function(){if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document.documentElement,{childList:true,subtree:true});
})();`;

/** Primer hijo de <body> en la tienda: activa Reveal antes de que llegue el contenido. */
export function RevealScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
