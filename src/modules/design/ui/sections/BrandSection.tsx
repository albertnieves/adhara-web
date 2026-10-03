import Image from 'next/image';
import { StarList, Text } from '@/components/ui';
import { Logo } from '@/modules/brand';
import { TONES } from '../../domain/tokens';
import { Section, SubTitle } from '../Section';

const RULES = [
  'Tamaño mínimo: en línea, el nombre a 14 px (size="sm", el del panel); compuesto, 160 px de ancho.',
  'Margen: alrededor, al menos la altura del nombre (1 em) libre de texto, bordes y otros elementos.',
  'Fondos: tinta sobre marfil, papel, arena o escenario; marfil sobre noche y los oscuros de colección. Siempre en un solo color.',
  'No: dorado, degradados, sombras, giros, deformaciones ni fotos sin un velo que garantice el contraste.',
];

export function BrandSection() {
  return (
    <Section
      id="marca"
      title="Marca"
      intro="Logotipo definitivo de L’Atelier du Désert (DECISIONS §56) en sus dos composiciones. Toma el color del texto de su tono, así que funciona en todos sin variantes."
    >
      <SubTitle>Reglas de uso</SubTitle>
      <StarList items={RULES} className="max-w-3xl text-sm" />
      <SubTitle>Fondos permitidos</SubTitle>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TONES.map((tone) => (
          <li
            key={tone.id}
            data-tone={tone.id === 'light' ? undefined : tone.id}
            className="bg-surface text-fg border-border flex flex-col items-start gap-6 border p-6"
          >
            <Logo />
            <Text as="span" size="caption" tone="muted">
              Tono {tone.label.toLowerCase()}
            </Text>
          </li>
        ))}
      </ul>
      <SubTitle>Margen y tamaño mínimo</SubTitle>
      <div className="flex flex-wrap items-end gap-8">
        <figure className="flex flex-col gap-2">
          {/* El margen punteado mide 1 em del tamaño del nombre. */}
          <span className="border-border-strong inline-block border border-dashed p-[1em] text-lg">
            <Logo />
          </span>
          <Text as="span" size="caption" tone="muted">
            Margen de 1 em
          </Text>
        </figure>
        <figure className="flex flex-col gap-2">
          <Logo size="sm" />
          <Text as="span" size="caption" tone="muted">
            Mínimo en línea (14 px)
          </Text>
        </figure>
        <figure className="flex flex-col gap-2">
          <Logo variant="stacked" className="w-40" />
          <Text as="span" size="caption" tone="muted">
            Mínimo compuesto (160 px)
          </Text>
        </figure>
      </div>
      <SubTitle>Iconos de la aplicación</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Revisados en DS-05: el emblema en tinta sobre marfil, con fondo opaco
        para iOS. No necesitan cambios.
      </Text>
      <div className="flex flex-wrap items-end gap-8">
        <figure className="flex flex-col gap-2">
          <Image
            src="/icon.svg"
            alt="Icono de la pestaña (icon.svg)"
            width={64}
            height={64}
            unoptimized
          />
          <Text as="span" size="caption" tone="muted">
            icon.svg
          </Text>
        </figure>
        <figure className="flex flex-col gap-2">
          <Image
            src="/apple-icon.png"
            alt="Icono de la pantalla de inicio (apple-icon.png)"
            width={90}
            height={90}
            unoptimized
          />
          <Text as="span" size="caption" tone="muted">
            apple-icon.png
          </Text>
        </figure>
      </div>
    </Section>
  );
}
