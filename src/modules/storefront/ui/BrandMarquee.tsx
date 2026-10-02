/** Nombres de las casas en bucle lento (se detiene con reduced motion). */
export function BrandMarquee({ brands }: { brands: string[] }) {
  if (brands.length === 0) return null;
  const row = [...brands, ...brands, ...brands];
  return (
    <div className="border-line overflow-hidden border-y py-10">
      <ul className="sr-only">
        {brands.map((brand) => (
          <li key={brand}>{brand}</li>
        ))}
      </ul>
      <div
        aria-hidden
        className="animate-marquee flex w-max gap-16 whitespace-nowrap hover:[animation-play-state:paused]"
      >
        {[...row, ...row].map((brand, index) => (
          <span
            key={`${brand}-${index}`}
            className="font-display text-fg-muted flex items-center gap-16 text-5xl font-light italic sm:text-7xl"
          >
            {brand}
            <span className="text-gold text-base not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
