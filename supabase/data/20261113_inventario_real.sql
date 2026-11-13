-- Carga de datos (no migración): inventario real de la tienda a 13/11/2026, a petición del
-- usuario, desde su hoja «Inventario compras — Oct 2026» (albarán 610220016 del 22/10 y
-- presupuestos 05577, 05578, 05579 y 05581 de Orient Fragance del 01/10, más dos líneas de un
-- presupuesto sin número): 140 líneas, 332 unidades, todas «Pendiente verificar» en la hoja.
-- · Las existencias anteriores (20 uds por perfume, de prueba) se sustituyen por las de la hoja;
--   lo que no está en la hoja queda a cero. Un STOCKTAKE_ADJUSTMENT por formato que cambia,
--   sin actor, con la referencia inventario-real-2026-11-13.
-- · E: formato ya publicado. D: perfume que estaba en borrador; se le crea el formato.
--   N: no estaba en el catálogo; se crea en borrador con el nombre del documento como
--   procedencia. Ninguno nuevo lleva PVP ni se publica: la hoja no trae precios de venta.
-- · Marca: la del documento; si no la dice, «Marca por identificar» (salvo Club de Nuit,
--   Haramain y Rayhaan, que van en el nombre). Formato sin volumen: «Formato por confirmar».
-- · EAN: solo los del albarán que la hoja no marca como poco legibles.
-- · Los costes de los presupuestos se registraron en internal.variant_cost_records el mismo
--   día y no se guardan en el repositorio. Los del albarán no: no dice si llevan IVA.
-- Idempotente. En una sola transacción (la tabla temporal se borra al confirmar).

begin;

insert into public.brands (slug, name) values
  ('rayhaan', 'Rayhaan'), ('arabiyat-prestige', 'Arabiyat Prestige'), ('al-absar', 'Al Absar'),
  ('bujairami', 'Bujairami'), ('mykonos', 'Mykonos'), ('gulf-orchid', 'Gulf Orchid'), ('afnan', 'Afnan')
on conflict (slug) do nothing;

create temporary table _inv (
  kind text, slug text, brand text, name text, conc text, ml integer, label text,
  ean text, pos integer, units integer, src text, variant_id uuid
) on commit drop;

-- E: publicados (slug, unidades).
insert into _inv (kind, slug, units)
select 'E', v.slug, v.units from (values
  ('asad-elixir',5), ('khamrah',4), ('reef-33',1), ('bharara-niche',1), ('bharara-queen',1),
  ('reef-33-white',1), ('reef-19',1), ('club-de-nuit-intense',1), ('club-de-nuit-untold',1),
  ('club-de-nuit-iconic',1), ('club-de-nuit-sillage',1), ('club-de-nuit-maleka',1),
  ('club-de-nuit-white-imperiale',1), ('club-de-nuit-milestone',1), ('odyssey-mandarin-sky',1),
  ('odyssey-artisto',1), ('odyssey-mandarin-sky-vintage-edition',1), ('odyssey-mega',1),
  ('odyssey-limoni',1), ('odyssey-candee',1), ('odyssey-revolution-ultra-edition',1),
  ('odyssey-toffee-coffee',1), ('voux-turquoise',1), ('yara-moi',1), ('yara-elixir',1),
  ('yara-aceite-concentrado',1), ('yara-moi-aceite-concentrado',1),
  ('yara-tous-aceite-concentrado',1), ('asad-bourbon',1), ('risk-comete',1), ('glitch',1),
  ('miss-sakura',1), ('miss-arrogate',1), ('little-garden',1), ('queen-rose',1),
  ('vulcan-baie',1), ('bharara-king',1), ('bharara-double-bleu',1), ('pharaoh-ramesses-i',1),
  ('bharara-the-collection',1), ('champagne-black',1), ('champagne-blue',1),
  ('champagne-pink',1), ('game-of-spades-queen',1)
) as v(slug, units);

-- D: borradores que ya estaban en el catálogo (slug, ml, etiqueta, EAN, orden, unidades).
insert into _inv (kind, slug, ml, label, ean, pos, units)
select 'D', v.* from (values
  ('vulcan-feu',null,'Formato por confirmar','6290360378053',0,4),
  ('royal-blend-nero',null,'Formato por confirmar','6290360375601',0,4),
  ('brioche-vanille',null,'Formato por confirmar','6290362347194',0,1),
  ('qaed-al-fursan-unlimited',null,'Formato por confirmar','6291108739020',0,6),
  ('qimmah-for-women',null,'Formato por confirmar','6291107450605',0,3),
  ('pure-crystal',null,'Formato por confirmar','6290362347095',0,3),
  ('musamam-white-intense',null,'Formato por confirmar','6290360593159',0,6),
  ('khamrah-qahwa',null,'Formato por confirmar',null,0,2),
  ('khamrah-dukhan',null,'Formato por confirmar',null,0,2),
  ('liquid-brun',null,'Formato por confirmar',null,2,2),
  ('liquid-brun',150,null,null,1,6),
  ('casablanca',100,null,null,0,1),
  ('liquid-brun',100,null,null,0,1),
  ('shaghaf-vanilla-toffee',75,null,null,0,2)
) as v(slug, ml, label, ean, pos, units);

-- N: nuevos (slug, marca, nombre, concentración, ml, etiqueta, EAN, unidades, procedencia).
insert into _inv (kind, slug, brand, name, conc, ml, label, ean, pos, units, src)
select 'N', v.slug, v.brand, v.name, v.conc, v.ml, v.label, v.ean, 0, v.units, v.src from (values
  ('espray-iris','marca-por-identificar','Espray Iris',null,null,'Formato por confirmar','3770036421144',20,'Albarán 610220016: «ESPRAY IRIS», 20 uds · IVA no indicado en albarán'),
  ('flint','marca-por-identificar','Flint',null,null,'Formato por confirmar','6290362340539',1,'Albarán 610220016: «FLINT», 1 uds · IVA no indicado en albarán'),
  ('zodiac','marca-por-identificar','Zodiac',null,null,'Formato por confirmar','6294879841169',1,'Albarán 610220016: «ZODIAC», 1 uds · IVA no indicado en albarán'),
  ('noa-arabic-desires','marca-por-identificar','Noa Arabic Desires',null,null,'Formato por confirmar','3700074925878',2,'Albarán 610220016: «NOA ARABIC DESIRES», 2 uds · IVA no indicado en albarán'),
  ('musk-tahara','marca-por-identificar','Musk Tahara',null,null,'Formato por confirmar',null,6,'Albarán 610220016: «MUSK TAHARA», 6 uds · Código interno, no EAN; IVA no indicado en albarán'),
  ('pack-pride','marca-por-identificar','Pack Pride',null,null,'Pack 5 × 20 ml (composición por confirmar)','6290362348078',4,'Albarán 610220016: «PACK PRIDE 5 P 20ML», 4 uds · Pack: confirmar composición (¿5 × 20 ml?); IVA no indicado en albarán'),
  ('pack-amethyst-collection','marca-por-identificar','Pack Amethyst Collection',null,null,'Formato por confirmar','6290362341208',1,'Albarán 610220016: «PACK AMETHYST COLLECTION», 1 uds · IVA no indicado en albarán'),
  ('pack-bint-houran','marca-por-identificar','Pack Bint Houran',null,null,'Formato por confirmar','6290362342786',2,'Albarán 610220016: «PACK BINT HOURAN», 2 uds · IVA no indicado en albarán'),
  ('gift-king-of-arabia','marca-por-identificar','Gift King of Arabia',null,null,'Formato por confirmar','6290362347996',2,'Albarán 610220016: «GIFT KING OF ARABIA», 2 uds · IVA no indicado en albarán'),
  ('gift-art-of-nature-ii','marca-por-identificar','Gift Art of Nature II',null,null,'Formato por confirmar','6290362347200',2,'Albarán 610220016: «GIFT ART OF NATURE II», 2 uds · IVA no indicado en albarán'),
  ('noor-riiffs','marca-por-identificar','Noor Riiffs',null,null,'Formato por confirmar','6297001574195',3,'Albarán 610220016: «NOOR RIIFFS», 3 uds · Posible errata en el nombre; IVA no indicado en albarán'),
  ('pack-roll-yara','marca-por-identificar','Pack Roll Yara',null,null,'Formato por confirmar','6295199792865',2,'Albarán 610220016: «PACK ROLL YARA», 2 uds · IVA no indicado en albarán'),
  ('bint-horan-mini','marca-por-identificar','Bint Horan Mini',null,null,'Formato por confirmar','6295199791370',2,'Albarán 610220016: «BINT HORAN MINI», 2 uds · Coste muy bajo (2,50): confirmar formato; IVA no indicado en albarán'),
  ('gift-set-vintage-radio','marca-por-identificar','Gift Set Vintage Radio',null,null,'Formato por confirmar','6290362346593',1,'Albarán 610220016: «GIFT SET VINTAGE RADIO», 1 uds · IVA no indicado en albarán'),
  ('her-confession-blanc','marca-por-identificar','Her Confession Blanc',null,null,'Formato por confirmar','6290360599120',3,'Albarán 610220016: «HER CONFESSION BLANC», 3 uds · IVA no indicado en albarán'),
  ('noa-hecho-a-mano','marca-por-identificar','Noa Hecho a Mano',null,null,'Formato por confirmar','3700074911703',3,'Albarán 610220016: «NOA HECHO A MANO», 3 uds · IVA no indicado en albarán'),
  ('art-of-nature-i','marca-por-identificar','Art of Nature I',null,null,'Formato por confirmar','6290360592008',3,'Albarán 610220016: «ART OF NATURE I», 3 uds · IVA no indicado en albarán'),
  ('art-of-universe','marca-por-identificar','Art of Universe',null,null,'Formato por confirmar','6290360592206',4,'Albarán 610220016: «ART OF UNIVERSE», 4 uds · IVA no indicado en albarán'),
  ('atheeri','marca-por-identificar','Atheeri',null,null,'Formato por confirmar','6290360598918',3,'Albarán 610220016: «ATHEERI», 3 uds · IVA no indicado en albarán'),
  ('al-haramain-amber-oud','al-haramain','Amber Oud',null,100,null,'6291100130122',3,'Albarán 610220016: «HARAMAIN AMBER OUD 100ML», 3 uds · IVA no indicado en albarán'),
  ('al-haramain-gold-999-9','al-haramain','Gold 999.9',null,null,'Formato por confirmar','6291106814835',3,'Albarán 610220016: «AL HARAMAIN GOLD 999.9», 3 uds · IVA no indicado en albarán'),
  ('club-de-nuit-travel-noir','armaf','Club de Nuit Travel Noir',null,null,'Formato por confirmar','6295199804414',2,'Albarán 610220016: «CLUB DE NUIT TRAVEL NOIR», 2 uds · IVA no indicado en albarán'),
  ('pack-club-de-nuit-travel-blanco','armaf','Pack Club de Nuit Travel Blanco',null,null,'Formato por confirmar','6295199802717',2,'Albarán 610220016: «PACK CLUB DE NUIT TRAVEL BLANCO», 2 uds · IVA no indicado en albarán'),
  ('rayhaan-terra','rayhaan','Terra',null,100,null,'6297001571262',4,'Albarán 610220016: «RAYHAAN TERRA», 3 uds · Mismo producto en albarán (18,00) y presup. 05577 (16,90): coste distinto; IVA no indicado en albarán · Presup. 05577: «RAYHAAN TERRA 100ML», 1 uds · Mismo producto en albarán (18,00) y presup. 05577 (16,90): coste distinto'),
  ('rayhaan-elixir','rayhaan','Elixir',null,100,null,'6297001571002',4,'Albarán 610220016: «RAYHAAN ELIXIR», 3 uds · Mismo producto en albarán (17,00) y presup. 05579 (17,90): coste distinto; IVA no indicado en albarán · Presup. 05579: «RAYHAAN ELIXIR 100ML», 1 uds · Mismo producto en albarán (17,00) y presup. 05579 (17,90): coste distinto; Falta pág. 2 de este presupuesto'),
  ('momento-gold','marca-por-identificar','Momento Gold',null,null,'Formato por confirmar',null,3,'Albarán 610220016: «MOMENTO GOLD», 3 uds · IVA no indicado en albarán; EAN poco legible en la foto: revisar'),
  ('ambientador','marca-por-identificar','Ambientador',null,null,'Formato por confirmar',null,12,'Albarán 610220016: «AMBIENTADOR», 12 uds · IVA no indicado en albarán; EAN poco legible en la foto: revisar'),
  ('imany-ambientador','marca-por-identificar','Imany Ambientador',null,null,'Formato por confirmar',null,72,'Albarán 610220016: «IMANY AMBIENTADOR», 72 uds · IVA no indicado en albarán; EAN poco legible en la foto: revisar'),
  ('blue-laverne-7am-pack','laverne','Blue Laverne 7AM Pack',null,200,null,null,3,'Presup. 05579: «BLUE LAVERNE 7AM PACK 200ML», 3 uds · Falta pág. 2 de este presupuesto'),
  ('rayhaan-aquatica','rayhaan','Aquatica',null,100,null,null,1,'Presup. 05579: «RAYHAAN AQUATICA 100 ML», 1 uds · Falta pág. 2 de este presupuesto'),
  ('rayhaan-italia','rayhaan','Italia',null,100,null,null,1,'Presup. 05579: «RAYHAAN ITALIA 100 ML», 1 uds · Falta pág. 2 de este presupuesto'),
  ('jasmine-and-honey','swiss-arabian','Jasmine and Honey','EDP',100,null,null,1,'Presup. 05579: «JASMINE AND HONEY 1413T 100ML EDP SA», 1 uds · Falta pág. 2 de este presupuesto'),
  ('shaghaf-amber-infusion','swiss-arabian','Shaghaf Amber Infusion','EDP',75,null,null,1,'Presup. 05579: «SHAGHAF AMBER INFUSION 985 75ML EDP», 1 uds · Falta pág. 2 de este presupuesto'),
  ('pack-sense-bolso-georgina','laverne','Pack Sense - Bolso Georgina',null,null,'Formato por confirmar',null,1,'Presup. 05579: «PACK SENSE - BOLSO GEORGINA», 1 uds · Falta pág. 2 de este presupuesto'),
  ('arsh-extrait','french-avenue','Arsh Extrait',null,100,null,null,1,'Presup. 05579: «ARSH EXTRAIT 100 ML», 1 uds · Falta pág. 2 de este presupuesto'),
  ('rose-and-patchouli','swiss-arabian','Rose and Patchouli','EDP',100,null,null,2,'Presup. 05579: «ROSE AND PATCHOULI 1413 100ML EDP SA», 2 uds · Falta pág. 2 de este presupuesto'),
  ('arabiyat-prestige-asha-a-blanc','arabiyat-prestige','Asha''a Blanc',null,110,null,null,2,'Presup. 05579: «ASHA''A BLANC - 110ML», 2 uds · Falta pág. 2 de este presupuesto'),
  ('arabiyat-prestige-ramad-oriental','arabiyat-prestige','Ramad Oriental','EDP',100,null,null,2,'Presup. 05579: «RAMAD ORIENTAL EDP 100ML», 2 uds · Falta pág. 2 de este presupuesto'),
  ('arabiyat-prestige-la-di-da-for-her','arabiyat-prestige','La Di Da for Her','EDP',100,null,null,2,'Presup. 05579: «LA DI DA FOR HER EDP 100ML», 2 uds · Falta pág. 2 de este presupuesto'),
  ('al-absar-shahoor-elixir','al-absar','Shahoor Elixir',null,100,null,null,2,'Presup. 05579: «SHAHOOR ELIXIR 100ML», 2 uds · Falta pág. 2 de este presupuesto'),
  ('al-absar-samaa-perfume','al-absar','Samaa Perfume',null,100,null,null,2,'Presup. 05579: «SAMAA PERFUME 100ML», 2 uds · Falta pág. 2 de este presupuesto'),
  ('vanilla-01','swiss-arabian','Vanilla 01','EXTRAIT',50,null,null,1,'Presup. 05581: «VANILLA 01 1080 50ML EXTRAIT DE PARFUM», 1 uds'),
  ('primal-code','swiss-arabian','Primal Code','EDP',100,null,null,1,'Presup. 05581: «PRIMAL CODE 1070 100ML EDP SA», 1 uds'),
  ('attacks','assaf','Attacks',null,150,null,null,1,'Presup. 05581: «ATTACKS 150ML», 1 uds'),
  ('musk-garden','laverne','Musk Garden',null,null,'Formato por confirmar',null,1,'Presup. 05581: «MUSK GARDEN», 1 uds · Volumen no indicado'),
  ('arabiyat-prestige-ramad-earthy-extrait','arabiyat-prestige','Ramad Earthy Extrait',null,100,null,null,2,'Presup. 05581: «RAMAD EARTHY EXTRAIT 100ML», 2 uds'),
  ('arabiyat-prestige-mouda-high-end','arabiyat-prestige','Mouda High End','EDP',100,null,null,2,'Presup. 05581: «MOUDA HIGH END EDP 100ML», 2 uds'),
  ('arabiyat-prestige-swar-serpentine','arabiyat-prestige','Swar Serpentine','EDP',100,null,null,2,'Presup. 05581: «SWAR SERPENTINE EDP 100ML», 2 uds'),
  ('kayaan-brun','armaf','Kayaan Brun',null,100,null,null,2,'Presup. 05581: «KAYAAN BRUN - 100ML», 2 uds'),
  ('voux-elegante','paris-corner','Voux Elegante',null,100,null,null,2,'Presup. 05581: «VOUX ELEGANTE 100ML», 2 uds'),
  ('al-absar-oud-al-samaawat','al-absar','Oud Al Samaawat',null,100,null,null,2,'Presup. 05581: «OUD AL SAMAAWAT - 100ML», 2 uds'),
  ('mehwish','paris-corner','Mehwish',null,100,null,null,2,'Presup. 05581: «MEHWISH 100ML», 2 uds'),
  ('gulf-orchid-baklava-bite','gulf-orchid','Baklava Bite',null,100,null,null,1,'Presup. 05581: «BAKLAVA BITE 100ml», 1 uds'),
  ('creme-of-clouds','fragrance-world','Creme of Clouds',null,null,'Formato por confirmar',null,1,'Presup. 05581: «CREME OF CLOUDS», 1 uds · Marca escrita ''FRAGANCE WORLD'' (¿Fragrance World?); volumen no indicado'),
  ('december-rose','paris-corner','December Rose',null,85,null,null,1,'Presup. 05581: «DECEMBER ROSE 85ML», 1 uds'),
  ('gulf-orchid-vanilla-latte','gulf-orchid','Vanilla Latte',null,100,null,null,1,'Presup. 05581: «VANILLA LATTE 100ML», 1 uds'),
  ('shaghaf-nectar-blush','swiss-arabian','Shaghaf Nectar Blush','EDP',75,null,null,1,'Presup. 05581: «SHAGHAF NECTAR BLUSH 985 75ML EDP SA», 1 uds'),
  ('arabiyat-prestige-forbidden','arabiyat-prestige','Forbidden','EDP',100,null,null,1,'Presup. 05581: «FORBIDDEN EDP 100ML», 1 uds'),
  ('secret-garden','laverne','Secret Garden',null,100,null,null,1,'Presup. 05581: «SECRET GARDEN 100 ML», 1 uds'),
  ('white-garden','laverne','White Garden',null,100,null,null,1,'Presup. 05581: «WHITE GARDEN 100 ML», 1 uds'),
  ('arabiyat-prestige-gelato-black-current-lolly','arabiyat-prestige','Gelato Black Current Lolly',null,100,null,null,2,'Presup. 05581: «GELATO BLACK CURRENT LOLLY - 100ML», 2 uds · Posible errata (¿Currant?)'),
  ('arabiyat-prestige-swar-d-amour','arabiyat-prestige','Swar d''Amour','EDP',100,null,null,2,'Presup. 05581: «SWAR D''AMOUR EDP 100ML», 2 uds'),
  ('bujairami-hectic','bujairami','Hectic',null,100,null,null,1,'Presup. 05577: «HECTIC 100 ML», 1 uds'),
  ('bujairami-mad-love','bujairami','Mad Love',null,100,null,null,1,'Presup. 05577: «MAD LOVE 100ML», 1 uds'),
  ('mykonos-conquer','mykonos','Conquer',null,100,null,null,1,'Presup. 05577: «CONQUER 100 ML», 1 uds'),
  ('ladour-bakhour','laverne','Ladour Bakhour',null,200,null,null,1,'Presup. 05577: «LADOUR BAKHOUR 200ML», 1 uds'),
  ('rayhaan-obsidian','rayhaan','Obsidian',null,100,null,null,1,'Presup. 05577: «RAYHAAN OBSIDIAN 100ML», 1 uds'),
  ('rayhaan-tropical-vibe','rayhaan','Tropical Vibe',null,100,null,null,1,'Presup. 05577: «TROPICAL VIBE 100ML», 1 uds'),
  ('rayhaan-nava-sol','rayhaan','Nava Sol',null,100,null,null,1,'Presup. 05577: «NAVA SOL 100 ML», 1 uds'),
  ('rayhaan-cedrus-blanc','rayhaan','Cedrus Blanc',null,100,null,null,1,'Presup. 05577: «CEDRUS BLANC 100 ML», 1 uds'),
  ('rayhaan-crimson','rayhaan','Crimson',null,100,null,null,1,'Presup. 05577: «RAYHAAN CRIMSON 100ML», 1 uds'),
  ('rayhaan-pharaoh','rayhaan','Pharaoh',null,100,null,null,1,'Presup. 05577: «RAYHAAN PHARAOH 100 ml», 1 uds'),
  ('rayhaan-aloha','rayhaan','Aloha',null,100,null,null,1,'Presup. 05577: «RAYHAAN ALOHA 100 ML», 1 uds'),
  ('rayhaan-tonquin-giza','rayhaan','Tonquin Giza',null,100,null,null,1,'Presup. 05577: «TONQUIN GIZA 100ML», 1 uds'),
  ('freeze-in-flames','marca-por-identificar','Freeze in Flames',null,100,null,null,1,'Presup. 05577: «FREEZE IN FLAMES 100ML», 1 uds · Marca no indicada en el documento'),
  ('afnan-9am-pour-femme-rosa','afnan','9AM Pour Femme Rosa',null,100,null,null,1,'Presup. 05577: «9AM POUR FEMME ROSA 100ML», 1 uds'),
  ('afnan-9pm-elixir','afnan','9PM Elixir',null,100,null,null,1,'Presup. 05577: «9PM ELIXIR - 100ML», 1 uds'),
  ('oud-07','swiss-arabian','Oud 07','EDP',50,null,null,1,'Presup. desconocido (solo pág. 2): «OUD 07 1080 50ML EDP SA», 1 uds · Falta pág. 1: nº y fecha desconocidos'),
  ('pure-instinct','swiss-arabian','Pure Instinct','EDP',100,null,null,1,'Presup. desconocido (solo pág. 2): «PURE INSTINCT 1070 100ML EDP SA», 1 uds · Falta pág. 1: nº y fecha desconocidos')
) as v(slug, brand, name, conc, ml, label, ean, units, src);

insert into public.products (id, brand_id, slug, name, concentration, position)
select extensions.uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, 'atelier:product:' || i.slug),
       b.id, i.slug, i.name, i.conc, 6000
from _inv i join public.brands b on b.slug = i.brand
where i.kind = 'N'
on conflict (slug) do nothing;

insert into public.product_sources (product_id, source_ref)
select p.id, left('Inventario real 13/11/2026 · ' || i.src, 2000)
from _inv i join public.products p on p.slug = i.slug
where i.kind = 'N'
on conflict (product_id) do nothing;

update _inv i set variant_id = case
  when i.kind = 'E' then (
    select v.id from public.product_variants v
    join public.products p on p.id = v.product_id where p.slug = i.slug
  )
  else extensions.uuid_generate_v5(
    '6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid,
    'atelier:variant:' || i.slug || ':' || coalesce(i.ml::text, 'None') || ':' || coalesce(i.label, 'None')
  )
end;

insert into public.product_variants (id, product_id, size_ml, label, ean, position)
select i.variant_id, p.id, i.ml, i.label, i.ean, i.pos
from _inv i join public.products p on p.slug = i.slug
where i.kind in ('D', 'N')
on conflict (id) do nothing;

do $$
declare
  v_location uuid := (select id from public.stock_locations where code = 'castelldefels');
  r record;
begin
  if (select count(*) from _inv i join public.product_variants v on v.id = i.variant_id) <> 137
     or (select sum(units) from _inv) <> 332 then
    raise exception 'hay formatos de la hoja que no existen';
  end if;
  for r in
    select pv.id as variant_id, coalesce(i.units, 0) as target,
           coalesce(l.on_hand, 0) as on_hand, coalesce(l.reserved, 0) as reserved
    from public.product_variants pv
    left join (select variant_id, sum(units)::integer as units from _inv group by 1) i
      on i.variant_id = pv.id
    left join public.inventory_levels l on l.variant_id = pv.id and l.location_id = v_location
    where coalesce(i.units, 0) <> coalesce(l.on_hand, 0)
    order by pv.id
  loop
    if r.reserved > r.target then
      raise exception 'reserva viva en %: no se ajusta', r.variant_id;
    end if;
    insert into public.inventory_levels (variant_id, location_id)
    values (r.variant_id, v_location)
    on conflict do nothing;
    update public.inventory_levels set on_hand = r.target, updated_at = now()
    where variant_id = r.variant_id and location_id = v_location;
    insert into public.inventory_movements (
      variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
      on_hand_after, reserved_after, reason, reference, actor_id
    ) values (
      r.variant_id, v_location, 'STOCKTAKE_ADJUSTMENT', r.target - r.on_hand,
      r.target - r.on_hand, 0, r.target, r.reserved,
      'Inventario real del 13/11/2026 (hoja «Inventario compras — Oct 2026»)',
      'inventario-real-2026-11-13', null
    );
  end loop;
end $$;

commit;
