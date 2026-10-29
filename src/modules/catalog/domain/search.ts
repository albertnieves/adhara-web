import type { StorefrontProduct } from './product';
import type { ScentFamily, ScentProfile } from './scent';
import { allNotes, NOTES, normalizeSearch } from './scent';

/**
 * Búsqueda de la tienda (roadmap 5, DECISIONS §181): perfumes por nombre,
 * casa, familia olfativa o nota, sin buscador externo. Con el catálogo
 * publicado (decenas o pocos cientos de perfumes) basta con buscar en el
 * navegador sobre lo que la página ya trae.
 */

export type SearchDocument = {
  product: StorefrontProduct;
  profile: ScentProfile | null;
};

export type SearchResult = {
  /** Perfumes que cumplen todas las palabras, los más parecidos primero. */
  products: StorefrontProduct[];
  /** Casas cuyo nombre contiene la búsqueda, con sus perfumes publicados. */
  brands: { slug: string; name: string; count: number }[];
  /** Familias cuyo nombre contiene alguna palabra, con sus perfumes. */
  families: { family: ScentFamily; count: number }[];
};

export const EMPTY_SEARCH: SearchResult = {
  products: [],
  brands: [],
  families: [],
};

/**
 * Palabras de la búsqueda, sin tildes ni mayúsculas: de 2 letras o más (una
 * sola letra lo encuentra todo) y como mucho 8.
 */
export function searchTerms(query: string): string[] {
  return normalizeSearch(query)
    .split(/[\s,.;:·/+-]+/)
    .filter((term) => term.length >= 2)
    .slice(0, 8);
}

/**
 * Busca en los perfumes publicados. Un perfume entra si cada palabra está en
 * su nombre, su casa, una de sus familias (en el idioma de la página o en
 * español) o una de sus notas (en cualquiera de los tres idiomas). Pesa más
 * el nombre que la casa, y la casa más que la familia o las notas; a igual
 * peso, el orden de la colección.
 */
export function searchCatalog(
  documents: readonly SearchDocument[],
  query: string,
  familyLabels: Readonly<Record<ScentFamily, readonly string[]>>,
): SearchResult {
  const terms = searchTerms(query);
  if (terms.length === 0) return EMPTY_SEARCH;
  const phrase = terms.join(' ');

  const scored = documents.flatMap((doc, index) => {
    const name = normalizeSearch(doc.product.name);
    const brand = normalizeSearch(doc.product.brand.name);
    const families = (doc.profile?.families ?? []).flatMap((family) =>
      familyLabels[family].map(normalizeSearch),
    );
    const notes = doc.profile
      ? allNotes(doc.profile).flatMap((key) => {
          const entry = NOTES[key];
          return [entry.es, entry.ca, entry.en].map(normalizeSearch);
        })
      : [];
    let score = 0;
    for (const term of terms) {
      const inName = name.includes(term);
      const inBrand = brand.includes(term);
      const inFamily = families.some((label) => label.includes(term));
      const inNotes = notes.some((label) => label.includes(term));
      if (!inName && !inBrand && !inFamily && !inNotes) return [];
      score +=
        (name.startsWith(term) || name.includes(` ${term}`) ? 6 : 0) +
        (inName ? 4 : 0) +
        (inBrand ? 3 : 0) +
        (inFamily ? 2 : 0) +
        (inNotes ? 1 : 0);
    }
    if (name.includes(phrase)) score += 10;
    return [{ product: doc.product, score, index }];
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const brands = new Map<
    string,
    { slug: string; name: string; count: number }
  >();
  for (const { product } of documents) {
    const current = brands.get(product.brand.slug);
    if (current) current.count += 1;
    else
      brands.set(product.brand.slug, {
        slug: product.brand.slug,
        name: product.brand.name,
        count: 1,
      });
  }

  const familyCounts = new Map<ScentFamily, number>();
  for (const doc of documents)
    for (const family of doc.profile?.families ?? [])
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);

  return {
    products: scored.map((hit) => hit.product),
    brands: [...brands.values()]
      .filter((brand) => normalizeSearch(brand.name).includes(phrase))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    families: [...familyCounts]
      .filter(([family]) =>
        familyLabels[family].some((label) =>
          terms.some((term) => normalizeSearch(label).includes(term)),
        ),
      )
      .map(([family, count]) => ({ family, count })),
  };
}
