-- Carga de datos (no migración): productos comprados a Orient Fragance, distribuidor
-- oficial en España (lista de compra del 30/09, 20 uds de cada uno), a petición del usuario.
-- PVP = precio de la tienda oficial https://www.orientfragance.com (URL en source_ref).
-- Sin PVP (quedan en borrador): Yara Aceite Concentrado (Yara Rosa 20 ml), Pharaoh Ramesses II y
-- Game of Spades Blind Bid, que la tienda oficial no vende. Los 4 lotes de la lista no se cargan
-- (falta saber qué contienen). Stock: recepción de 20 uds en la Tienda de Castelldefels,
-- registrada como carga (sin actor) con la referencia compra-orient-fragance-2026-09-30.
-- Idempotente.

insert into public.brands (slug, name) values
  ('assaf', 'Assaf'),
  ('laverne', 'Laverne'),
  ('bharara', 'Bharara'),
  ('jo-milano', 'Jo Milano'),
  ('reef', 'Reef')
on conflict (slug) do nothing;

insert into public.products (id, brand_id, slug, name, concentration, audience, position, source_ref)
select v.id::uuid, b.id, v.slug, v.name, v.conc, v.aud, v.pos, v.src
from (values
  ('49a089fa-2633-59ee-be87-b0c74fd80272', 'armaf', 'odyssey-mandarin-sky-vintage-edition', 'Odyssey Mandarin Sky Vintage Edition', null, 'unisex', 5000, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Mandarin Sky Vintage 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-odyssey-mandarin-sky-vintage-edition-100ml-eau-de-parfum-perfume-unisex'),
  ('b7f6280d-a021-50c4-bb15-dbcd518a4af6', 'armaf', 'odyssey-mega', 'Odyssey Mega', null, 'unisex', 5001, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Mega 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/odissey-mega-100ml-armaf'),
  ('9c4fa4ae-56f5-591a-ad7d-a07a7b11b2b8', 'armaf', 'odyssey-limoni', 'Odyssey Limoni', null, 'unisex', 5002, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Limoni 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/odyssey-limoni-100ml-eau-de-parfum-armaf'),
  ('d41ed841-e745-51b8-a9c7-edd958d76ed1', 'armaf', 'odyssey-candee', 'Odyssey Candee', null, 'women', 5003, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Candee 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/odyssey-candee-100ml-edp-mujer-armaf'),
  ('129dea42-3cde-5963-976a-658e867a1813', 'armaf', 'odyssey-toffee-coffee', 'Odyssey Toffee Coffee', null, 'unisex', 5004, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Toffee Coffee 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-odyssey-toffee-coffee-100ml-eau-de-parfum-perfume-unisex'),
  ('d0807d45-fd59-56c2-a529-1c5f0de76445', 'armaf', 'odyssey-mandarin-sky', 'Odyssey Mandarin Sky', null, 'men', 5005, 'Compra a Orient Fragance (lista del 30/09: «Odyssey Mandarin Sky 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/odyssey-mandarin-sky-100ml-eau-de-parfum-armaf-perfumes'),
  ('85f08556-073c-515e-9763-ed43236384a0', 'armaf', 'club-de-nuit-maleka', 'Club de Nuit Maleka', null, 'women', 5006, 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Maleka 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-club-de-nuit-maleka-100ml-eau-de-parfum-perfume-femenino'),
  ('3e43ed72-ffc7-531c-baf2-f7fc35774f93', 'armaf', 'club-de-nuit-white-imperiale', 'Club de Nuit White Imperiale', null, 'women', 5007, 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Imperiale White 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/club-de-nuit-white-imperiale-105ml-eau-de-parfum-armaf-perfumes'),
  ('3dc7c7a5-a9ef-5259-be98-85a0db5885af', 'paris-corner', 'voux-turquoise', 'Voux Turquoise', null, 'unisex', 5008, 'Compra a Orient Fragance (lista del 30/09: «Voux Turquoise 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/voux-turquoise-emir-100ml-eau-de-parfum-paris-corner'),
  ('4c847ef6-099a-5bb6-97fa-b1473013ecb3', 'french-avenue', 'vulcan-baie', 'Vulcan Baie', null, 'unisex', 5009, 'Compra a Orient Fragance (lista del 30/09: «Vulcan Baie 100 ml (Fragrance World)», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/french-avenue-vulcan-baie-100ml-eau-de-parfum-perfume-unisex'),
  ('37c02b12-86fb-50f0-bd9f-c05d7d93f316', 'lattafa', 'yara-moi-aceite-concentrado', 'Yara Moi Aceite Concentrado', 'OIL', null, 5010, 'Compra a Orient Fragance (lista del 30/09: «Yara Moi 20 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/lattafa-yara-moi-20ml-aceite-concentrado-perfume-femenino'),
  ('f2c4e48f-b2dc-55eb-9b8a-414cb7c707ce', 'lattafa', 'yara-tous-aceite-concentrado', 'Yara Tous Aceite Concentrado', 'OIL', null, 5011, 'Compra a Orient Fragance (lista del 30/09: «Yara Tous 20 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/lattafa-yara-tous-20ml-aceite-concentrado-perfume-femenino'),
  ('8accad9c-575c-5920-90b9-9cf60e4e9a22', 'lattafa', 'yara-aceite-concentrado', 'Yara Aceite Concentrado', 'OIL', null, 5012, 'Compra a Orient Fragance (lista del 30/09: «Yara Rosa 20 ml», 20 uds) · la tienda oficial no lo vende: PVP pendiente'),
  ('b6278bd4-611c-5e94-9504-62a029020027', 'assaf', 'risk-comete', 'Risk Comete', null, 'unisex', 5013, 'Compra a Orient Fragance (lista del 30/09: «Risk Comete 150 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/assaf-risk-comete-150ml-eau-de-parfum-perfume-unisex'),
  ('bcc8ec26-a3b1-53c0-8142-6b5f6ebea1a3', 'assaf', 'glitch', 'Glitch', null, 'unisex', 5014, 'Compra a Orient Fragance (lista del 30/09: «Glitch 150 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/assaf-glitch-150ml-eau-de-parfum-perfume-unisex'),
  ('c1f02e1a-2d01-5494-8442-c07f14840937', 'assaf', 'miss-sakura', 'Miss Sakura', null, 'women', 5015, 'Compra a Orient Fragance (lista del 30/09: «Miss Sakura 200 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/assaf-miss-sakura-200ml-eau-de-parfum-perfume-femenino'),
  ('43f6c1a8-1c7a-587c-b116-617c72e3c75e', 'assaf', 'miss-arrogate', 'Miss Arrogate', null, 'women', 5016, 'Compra a Orient Fragance (lista del 30/09: «Miss Arrogate 200 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/assaf-miss-arrogate-200ml-eau-de-parfum-perfume-femenino'),
  ('3118b105-c818-5fba-9c11-3d2e449cf0bd', 'laverne', 'little-garden', 'Little Garden', null, 'women', 5017, 'Compra a Orient Fragance (lista del 30/09: «Little Garden Package 10 ml × 5», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/laverne-little-garden-a-set-for-her-10ml-5-eau-de-parfum-perfume-femenino'),
  ('35c7ba18-08cd-554b-84d2-3e829ae427fa', 'laverne', 'queen-rose', 'Queen Rose', null, 'women', 5018, 'Compra a Orient Fragance (lista del 30/09: «Queen Rose 200 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/laverne-queen-rose-200ml-eau-de-parfum-perfume-femenino'),
  ('31325e2c-cc9b-5ad6-8991-6ca71d19b49a', 'bharara', 'bharara-king', 'King', null, 'men', 5019, 'Compra a Orient Fragance (lista del 30/09: «Bharara King Eau de Parfum 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-king-100ml-eau-de-parfum-bharara-perfumes-un-elixir-de-frescura-y-elegancia'),
  ('76f75a51-61f4-5bf8-88a3-2653dbaad416', 'bharara', 'bharara-queen', 'Queen', null, 'women', 5020, 'Compra a Orient Fragance (lista del 30/09: «Bharara Queen 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-queen-100ml-eau-de-parfum-perfume-femenino'),
  ('fed1dcf7-231d-50d4-b7e4-8bccc2b5d169', 'bharara', 'bharara-double-bleu', 'Double Bleu', null, 'men', 5021, 'Compra a Orient Fragance (lista del 30/09: «Bharara Doble Bleu 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-doble-bleu-100ml-eau-de-parfum-bharara-perfumes-frescura-citrica-y-dulzura-envolvente'),
  ('1ae0e8df-f61f-5cf0-879d-fd96a74a08bc', 'bharara', 'pharaoh-ramesses-i', 'Pharaoh Ramesses I', null, 'men', 5022, 'Compra a Orient Fragance (lista del 30/09: «Bharara Pharaon Ramsses I 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-pharaoh-ramasses-100ml-eau-de-parfum-bharara-beauty'),
  ('05a1d25d-b25f-5b76-95e2-4c1893d0083b', 'bharara', 'pharaoh-ramesses-ii', 'Pharaoh Ramesses II', null, null, 5023, 'Compra a Orient Fragance (lista del 30/09: «Bharara Pharaon Ramsses II Men Parfum 100 ml», 20 uds) · la tienda oficial no lo vende: PVP pendiente'),
  ('9504cdb9-ad63-596b-ac51-5d3284e55122', 'bharara', 'bharara-the-collection', 'The Collection', null, 'unisex', 5024, 'Compra a Orient Fragance (lista del 30/09: «Bharara The Collection Set 7 × 10 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-the-collection-7-pcs-100ml-eau-de-parfum-bharara'),
  ('1ebfb35e-0a22-5b51-ab7e-cbe2866259ff', 'bharara', 'bharara-niche', 'Niche', null, 'unisex', 5025, 'Compra a Orient Fragance (lista del 30/09: «Bharara Niche 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/niche-100ml-eau-de-parfum-bharara-perfumes-un-viaje-olfativo-de-frescura-dulzura-y-calidez-natural'),
  ('21f025e9-56f4-503f-9bcf-97a2e39ffb51', 'bharara', 'champagne-black', 'Champagne Black', null, 'men', 5026, 'Compra a Orient Fragance (lista del 30/09: «Bharara Champagne Black 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-champagne-black-100ml-eau-de-parfum-bharara'),
  ('5b3010bb-1f7a-5644-8141-332377d31ead', 'bharara', 'champagne-blue', 'Champagne Blue', null, 'men', 5027, 'Compra a Orient Fragance (lista del 30/09: «Bharara Champagne Blue 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-champagne-blue-100ml-eau-de-parfum-perfume-masculino'),
  ('5ecf2072-8967-5191-97aa-6d560c952d70', 'bharara', 'champagne-pink', 'Champagne Pink', null, 'women', 5028, 'Compra a Orient Fragance (lista del 30/09: «Bharara Champagne Pink Pour Femme EDP 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/bharara-champagne-pink-100ml-eau-de-parfum-bharara'),
  ('3e325b57-3c38-5774-8f5d-5334fa62a2e2', 'jo-milano', 'game-of-spades-queen', 'Game of Spades Queen', null, null, 5029, 'Compra a Orient Fragance (lista del 30/09: «Jo Milano Game of Spades Queen Women 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/jo-milano-game-of-spades-queen-women-100ml-eau-de-parfum-bharara'),
  ('34c52139-eb73-556c-8826-fccf2e490872', 'jo-milano', 'game-of-spades-blind-bid', 'Game of Spades Blind Bid', null, null, 5030, 'Compra a Orient Fragance (lista del 30/09: «Blind Bid 100 ml (Game of Spades)», 20 uds) · la tienda oficial no lo vende: PVP pendiente'),
  ('18794610-9efe-5cf5-9721-1d3726190cf8', 'reef', 'reef-33', 'Reef 33', null, 'unisex', 5031, 'Compra a Orient Fragance (lista del 30/09: «Reef 33 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/reef-33-100ml-eau-de-parfum-reef'),
  ('45823c3c-0ef7-526d-a1a2-9d26beeb7fb0', 'reef', 'reef-33-white', 'Reef 33 White', null, 'unisex', 5032, 'Compra a Orient Fragance (lista del 30/09: «Reef 33 White 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/reef-33-white-100ml-eau-de-parfum-reef'),
  ('ee91efb8-f5e6-53a5-b8e3-54d84e82ec35', 'reef', 'reef-19', 'Reef 19', null, 'women', 5033, 'Compra a Orient Fragance (lista del 30/09: «Reef 19 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/reef-19-100ml-eau-de-parfum-reef')
) as v(id, brand, slug, name, conc, aud, pos, src)
join public.brands b on b.slug = v.brand
on conflict (slug) do nothing;

-- Procedencia de la compra y del PVP en los perfumes que ya estaban en el catálogo.
update public.products p set source_ref = p.source_ref || ' · ' || v.src
from (values
  ('yara-moi', 'Compra a Orient Fragance (lista del 30/09: «Yara Moi 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/yara-moi-100ml-eau-de-parfum-perfumes-lattafa'),
  ('yara-elixir', 'Compra a Orient Fragance (lista del 30/09: «Yara Elixir», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/lattafa-yara-elixir-100ml-eau-perfume-perfume-femenino'),
  ('asad-bourbon', 'Compra a Orient Fragance (lista del 30/09: «Asad Bourbon 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/asad-bourbon-100ml-eau-de-parfum-lattafa'),
  ('asad-elixir', 'Compra a Orient Fragance (lista del 30/09: «Asad Elixir», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/lattafa-asad-elixir-100ml-eau-de-parfum-perfume-masculino'),
  ('vulcan-sable', 'Compra a Orient Fragance (lista del 30/09: «Vulcan Sable 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/french-avenue-vulcan-sable-100ml-eau-de-parfum-perfume-unisex'),
  ('club-de-nuit-intense', 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Intense Man EDT 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/club-de-nuit-intense-men-200ml-eau-de-parfum-armaf-perfumes'),
  ('club-de-nuit-untold', 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Untold 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/club-de-nuit-untold-105ml-eau-de-parfum-armaf-perfumes'),
  ('club-de-nuit-iconic', 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Blue Iconic 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/club-de-nuit-blue-iconic-105ml-eau-de-parfum-armaf-perfumes'),
  ('club-de-nuit-sillage', 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Sillage 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/club-de-nuit-sillage-105ml-armaf'),
  ('club-de-nuit-milestone', 'Compra a Orient Fragance (lista del 30/09: «Club de Nuit Milestone 105 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-club-de-nuit-milestone-105ml-eau-de-parfum-perfume-unisex'),
  ('odyssey-artisto', 'Compra a Orient Fragance (lista del 30/09: «Odyssey Artisto 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-odyssey-artisto-100ml-eau-de-parfum-perfume-unisex'),
  ('odyssey-revolution-ultra-edition', 'Compra a Orient Fragance (lista del 30/09: «Odyssey Revolution 100 ml», 20 uds) · PVP de la tienda oficial: https://www.orientfragance.com/products/armaf-odyssey-revolution-100ml-eau-de-parfum-perfume-unisex')
) as v(slug, src)
where p.slug = v.slug and p.source_ref not like '%Compra a Orient Fragance%';

-- Un único formato por perfume, con el PVP de la tienda oficial.
insert into public.product_variants (id, product_id, size_ml, label, retail_price_cents, position)
select v.id::uuid, p.id, v.ml, v.label, v.cents, 0
from (values
  ('d08d4e98-fd0a-5ceb-968d-ae7493b1e472', 'odyssey-mandarin-sky-vintage-edition', 100, null, 3490),
  ('2a16c1b5-6634-54ab-b788-a9f8f9dd8df9', 'odyssey-mega', 100, null, 3590),
  ('e9eb9c40-ca96-52b3-8e25-bd740b8df0af', 'odyssey-limoni', 100, null, 3290),
  ('71ff91e8-7030-59a8-b5c3-2a0fd1afd739', 'odyssey-candee', 100, null, 2390),
  ('cd334b5c-214f-5406-bc6f-ea5df2c853a2', 'odyssey-toffee-coffee', 100, null, 3590),
  ('c3db885e-4a05-5949-884f-ae5ae817bab7', 'odyssey-mandarin-sky', 100, null, 3590),
  ('56cfe0fa-6855-5f2e-b0b2-18d80ecd2cd9', 'club-de-nuit-maleka', 105, null, 3995),
  ('26ef76b0-7a89-513f-9160-60bd4efa97f0', 'club-de-nuit-white-imperiale', 105, null, 4550),
  ('021eb673-f095-5035-a097-57b9ecff68e9', 'voux-turquoise', 100, null, 3390),
  ('145d4853-fe5a-5519-80b1-557b9fa73873', 'vulcan-baie', 100, null, 4590),
  ('db029fcc-5486-5dec-8d7e-05db7cbfc45a', 'yara-moi-aceite-concentrado', 20, null, 2850),
  ('ece512f8-5ffe-570b-a356-a29470b948dd', 'yara-tous-aceite-concentrado', 20, null, 2850),
  ('063cc8ef-9ab0-59c1-b928-79fc3826dc20', 'yara-aceite-concentrado', 20, null, null),
  ('90efa718-79ca-5994-8886-85cdc8caa3cf', 'risk-comete', 150, null, 7490),
  ('a0e618d3-361b-52c3-94f6-3d2045a5d3fa', 'glitch', 150, null, 7490),
  ('9c7c2eb8-e912-558b-9032-9798d20ce0a6', 'miss-sakura', 200, null, 6490),
  ('abeebf40-35a3-54e2-90af-9d12e292b30b', 'miss-arrogate', 200, null, 6490),
  ('56158bad-a7a2-51dd-976f-5efb3381fa20', 'little-garden', null, 'Set 5 × 10 ml', 7500),
  ('dbd41480-7721-50a6-b251-b2105643e94a', 'queen-rose', 200, null, 9900),
  ('4aa76b47-acc3-5e3c-b051-1d7881f233c5', 'bharara-king', 100, null, 12400),
  ('d469090f-9e09-5f00-aa00-6a050b992851', 'bharara-queen', 100, null, 12400),
  ('d696a521-30d9-59d5-a595-4efe2a525d0a', 'bharara-double-bleu', 100, null, 12400),
  ('873323d4-4a34-5d1f-ae9f-53ca12cf1561', 'pharaoh-ramesses-i', 100, null, 17500),
  ('8aba09a6-79e5-5c46-b4cf-0775b3acd59d', 'pharaoh-ramesses-ii', 100, null, null),
  ('1b597e0c-a4f8-5c56-a637-9ff660e19c6c', 'bharara-the-collection', null, 'Set 7 × 10 ml', 13200),
  ('eeaab826-4fdc-52b2-90f9-a7953836e91d', 'bharara-niche', 100, null, 13400),
  ('49ec78cd-70b8-51ee-b4e3-b9dcff69fe8f', 'champagne-black', 100, null, 4500),
  ('85201ae1-c324-5926-a482-da0b3f5923b8', 'champagne-blue', 100, null, 4500),
  ('1d4ed296-77f2-5bbd-8334-ac7185422bd0', 'champagne-pink', 100, null, 4500),
  ('cde35e23-055c-57f4-8b15-f3dc49af6af8', 'game-of-spades-queen', 100, null, 15500),
  ('a890cc8a-d4af-5292-a8d0-f088bdd0816a', 'game-of-spades-blind-bid', 100, null, null),
  ('ee941311-36ee-5d3e-9f74-a6d6c1a64dd0', 'reef-33', 100, null, 9900),
  ('d95c0c07-9b5d-5426-9ce0-cd7370435afe', 'reef-33-white', 100, null, 9900),
  ('420bb663-6f88-531e-b695-a3e60e63cef6', 'reef-19', 100, null, 9900),
  ('d8893192-dd88-5b9c-b770-6e2221db35c0', 'yara-moi', 100, null, 2990),
  ('7006ac93-a26f-53af-8224-b710a3b0f9e2', 'yara-elixir', 100, null, 2990),
  ('39b47591-e737-5d27-8cbe-cd04a470e2b6', 'asad-bourbon', 100, null, 2990),
  ('8f7600f0-325e-5567-b45c-b6569b187b91', 'asad-elixir', 100, null, 2990),
  ('a1f9a67b-6082-5239-bf96-69ae9e29b1f5', 'vulcan-sable', 100, null, 4500),
  ('fee46433-14e8-5001-b4ed-8aa86e7684a5', 'club-de-nuit-intense', 105, null, 4990),
  ('961b0b07-06c0-5dc6-bbc1-9e1d974d76c0', 'club-de-nuit-untold', 105, null, 4990),
  ('1f56286e-64f5-5d82-8aff-364fe1e714ec', 'club-de-nuit-iconic', 105, null, 4990),
  ('81ed00eb-60bf-5830-9cb1-40d60e45d65e', 'club-de-nuit-sillage', 105, null, 4990),
  ('68bf1838-088f-5b96-adf3-e36c54af0218', 'club-de-nuit-milestone', 105, null, 4500),
  ('c97812a8-caf6-5eda-b210-b516841cbe45', 'odyssey-artisto', 100, null, 3290),
  ('d56fabfd-da8d-5bc7-a235-2adf23898557', 'odyssey-revolution-ultra-edition', 100, null, 3250)
) as v(id, slug, ml, label, cents)
join public.products p on p.slug = v.slug
where not exists (select 1 from public.product_variants x where x.product_id = p.id);

-- Recepción de 20 uds por formato (mismas escrituras que admin_record_inventory_movement).
do $$
declare
  r record;
  loc uuid := (select id from public.stock_locations where code = 'castelldefels');
  lvl public.inventory_levels;
  mv public.inventory_movements;
begin
  for r in
    select v.id as variant_id
    from public.product_variants v join public.products p on p.id = v.product_id
    where p.slug = any(array['odyssey-mandarin-sky-vintage-edition', 'odyssey-mega', 'odyssey-limoni', 'odyssey-candee', 'odyssey-toffee-coffee', 'odyssey-mandarin-sky', 'club-de-nuit-maleka', 'club-de-nuit-white-imperiale', 'voux-turquoise', 'vulcan-baie', 'yara-moi-aceite-concentrado', 'yara-tous-aceite-concentrado', 'yara-aceite-concentrado', 'risk-comete', 'glitch', 'miss-sakura', 'miss-arrogate', 'little-garden', 'queen-rose', 'bharara-king', 'bharara-queen', 'bharara-double-bleu', 'pharaoh-ramesses-i', 'pharaoh-ramesses-ii', 'bharara-the-collection', 'bharara-niche', 'champagne-black', 'champagne-blue', 'champagne-pink', 'game-of-spades-queen', 'game-of-spades-blind-bid', 'reef-33', 'reef-33-white', 'reef-19', 'yara-moi', 'yara-elixir', 'asad-bourbon', 'asad-elixir', 'vulcan-sable', 'club-de-nuit-intense', 'club-de-nuit-untold', 'club-de-nuit-iconic', 'club-de-nuit-sillage', 'club-de-nuit-milestone', 'odyssey-artisto', 'odyssey-revolution-ultra-edition'])
  loop
    continue when exists (
      select 1 from public.inventory_movements m
      where m.variant_id = r.variant_id and m.reference = 'compra-orient-fragance-2026-09-30'
    );
    insert into public.inventory_levels (variant_id, location_id)
    values (r.variant_id, loc) on conflict do nothing;
    select * into lvl from public.inventory_levels
    where variant_id = r.variant_id and location_id = loc for update;
    update public.inventory_levels set on_hand = on_hand + 20, updated_at = now()
    where variant_id = r.variant_id and location_id = loc;
    insert into public.inventory_movements (
      variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
      on_hand_after, reserved_after, reason, reference, actor_id
    ) values (
      r.variant_id, loc, 'PURCHASE_RECEIPT', 20, 20, 0, lvl.on_hand + 20, lvl.reserved,
      'Carga inicial: compra a Orient Fragance (lista del 30/09)', 'compra-orient-fragance-2026-09-30', null
    ) returning * into mv;
    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values (
      null, 'inventory.purchase_receipt', 'inventory_level', r.variant_id::text || '@' || loc::text,
      jsonb_build_object('on_hand', lvl.on_hand, 'reserved', lvl.reserved),
      jsonb_build_object('on_hand', mv.on_hand_after, 'reserved', mv.reserved_after, 'movement_id', mv.id)
    );
  end loop;
end $$;

-- Publicar los que tienen PVP.
update public.products set status = 'published'
where status = 'draft' and slug = any(array['odyssey-mandarin-sky-vintage-edition', 'odyssey-mega', 'odyssey-limoni', 'odyssey-candee', 'odyssey-toffee-coffee', 'odyssey-mandarin-sky', 'club-de-nuit-maleka', 'club-de-nuit-white-imperiale', 'voux-turquoise', 'vulcan-baie', 'yara-moi-aceite-concentrado', 'yara-tous-aceite-concentrado', 'risk-comete', 'glitch', 'miss-sakura', 'miss-arrogate', 'little-garden', 'queen-rose', 'bharara-king', 'bharara-queen', 'bharara-double-bleu', 'pharaoh-ramesses-i', 'bharara-the-collection', 'bharara-niche', 'champagne-black', 'champagne-blue', 'champagne-pink', 'game-of-spades-queen', 'reef-33', 'reef-33-white', 'reef-19', 'yara-moi', 'yara-elixir', 'asad-bourbon', 'asad-elixir', 'vulcan-sable', 'club-de-nuit-intense', 'club-de-nuit-untold', 'club-de-nuit-iconic', 'club-de-nuit-sillage', 'club-de-nuit-milestone', 'odyssey-artisto', 'odyssey-revolution-ultra-edition']);

-- Fotos oficiales de marca (provisionales), subidas al bucket product-media de adhara-dev
-- el 30/09 con la cuenta temporal de pruebas, por autorización expresa del usuario.
insert into public.product_media (id, product_id, url, alt, role, origin, source, provisional, position)
select v.id::uuid, p.id,
  'https://xgpsislololgbakzcmad.supabase.co/storage/v1/object/public/product-media/' || v.path,
  v.alt, case when v.pos = 0 then 'hero' else 'gallery' end, 'brand_official', v.source, true, v.pos
from (values
  ('05509066-c24a-51f3-b32d-b7cda011e38e', 'odyssey-mandarin-sky-vintage-edition', '49a089fa-2633-59ee-be87-b0c74fd80272/05509066-c24a-51f3-b32d-b7cda011e38e.webp', 'Armaf Odyssey Mandarin Sky Vintage Edition, foto oficial de la marca', 0, 'https://armaf.com/products/odyssey-mandarin-sky-vintage-edition'),
  ('5fc6d620-13c5-5935-92e8-97c0626f5097', 'odyssey-mega', 'b7f6280d-a021-50c4-bb15-dbcd518a4af6/5fc6d620-13c5-5935-92e8-97c0626f5097.webp', 'Armaf Odyssey Mega, foto oficial de la marca', 0, 'https://armaf.com/products/odyssey-mega-man'),
  ('9912436d-d13a-5b7a-9088-eb475995fdfd', 'odyssey-mega', 'b7f6280d-a021-50c4-bb15-dbcd518a4af6/9912436d-d13a-5b7a-9088-eb475995fdfd.webp', 'Armaf Odyssey Mega, foto oficial de la marca', 1, 'https://armaf.com/products/odyssey-mega-man'),
  ('354ded25-c392-5711-9233-c51eb6ebff49', 'odyssey-limoni', '9c4fa4ae-56f5-591a-ad7d-a07a7b11b2b8/354ded25-c392-5711-9233-c51eb6ebff49.webp', 'Armaf Odyssey Limoni, foto oficial de la marca', 0, 'https://armaf.com/products/armaf-odyssey-limoni-fresh-edition'),
  ('c214143b-38b4-5fde-aa7a-a00bfdcaf190', 'odyssey-limoni', '9c4fa4ae-56f5-591a-ad7d-a07a7b11b2b8/c214143b-38b4-5fde-aa7a-a00bfdcaf190.webp', 'Armaf Odyssey Limoni, foto oficial de la marca', 1, 'https://armaf.com/products/armaf-odyssey-limoni-fresh-edition'),
  ('672eebe2-2a58-5825-ae28-46d7df881f28', 'odyssey-candee', 'd41ed841-e745-51b8-a9c7-edd958d76ed1/672eebe2-2a58-5825-ae28-46d7df881f28.webp', 'Armaf Odyssey Candee, foto oficial de la marca', 0, 'https://armaf.com/products/odyssey-candee-special-edition'),
  ('7b5046ec-55d4-5956-be52-31826e1e229c', 'odyssey-toffee-coffee', '129dea42-3cde-5963-976a-658e867a1813/7b5046ec-55d4-5956-be52-31826e1e229c.webp', 'Armaf Odyssey Toffee Coffee, foto oficial de la marca', 0, 'https://armaf.com/products/odyssey-toffee-coffee'),
  ('7ddfd863-867f-5d48-aa1b-8ea3896ad9d1', 'odyssey-mandarin-sky', 'd0807d45-fd59-56c2-a529-1c5f0de76445/7ddfd863-867f-5d48-aa1b-8ea3896ad9d1.webp', 'Armaf Odyssey Mandarin Sky, foto oficial de la marca', 0, 'https://armaf.com/products/odyssey-mega-for-men'),
  ('47898e17-0641-5dea-8394-d9d78db3196c', 'odyssey-mandarin-sky', 'd0807d45-fd59-56c2-a529-1c5f0de76445/47898e17-0641-5dea-8394-d9d78db3196c.webp', 'Armaf Odyssey Mandarin Sky, foto oficial de la marca', 1, 'https://armaf.com/products/odyssey-mega-for-men'),
  ('6ebe6630-82c5-5c60-8bd1-b5d8442be544', 'club-de-nuit-maleka', '85f08556-073c-515e-9763-ed43236384a0/6ebe6630-82c5-5c60-8bd1-b5d8442be544.webp', 'Armaf Club de Nuit Maleka, foto oficial de la marca', 0, 'https://armaf.com/products/club-de-nuit-maleka'),
  ('0b3744a9-9752-570a-a189-f3dd2f9f4c11', 'club-de-nuit-white-imperiale', '3e43ed72-ffc7-531c-baf2-f7fc35774f93/0b3744a9-9752-570a-a189-f3dd2f9f4c11.webp', 'Armaf Club de Nuit White Imperiale, foto oficial de la marca', 0, 'https://armaf.com/products/armaf-club-de-nuit-white-imperial-buy-original-perfumes-online-uae'),
  ('9e055922-b865-5409-879c-ae6b0c274c44', 'club-de-nuit-white-imperiale', '3e43ed72-ffc7-531c-baf2-f7fc35774f93/9e055922-b865-5409-879c-ae6b0c274c44.webp', 'Armaf Club de Nuit White Imperiale, foto oficial de la marca', 1, 'https://armaf.com/products/armaf-club-de-nuit-white-imperial-buy-original-perfumes-online-uae'),
  ('369dd926-770c-59e6-a94d-37a251ce5ccd', 'vulcan-baie', '4c847ef6-099a-5bb6-97fa-b1473013ecb3/369dd926-770c-59e6-a94d-37a251ce5ccd.webp', 'French Avenue Vulcan Baie, foto oficial de la marca', 0, 'https://frenchavenue.com/products/vulcan-baie'),
  ('d3963191-2123-5c52-b02e-305e1c58fec0', 'vulcan-baie', '4c847ef6-099a-5bb6-97fa-b1473013ecb3/d3963191-2123-5c52-b02e-305e1c58fec0.webp', 'French Avenue Vulcan Baie, foto oficial de la marca', 1, 'https://frenchavenue.com/products/vulcan-baie'),
  ('f0dcfb7d-5aee-556e-8950-ec9cd2cc5671', 'yara-aceite-concentrado', '8accad9c-575c-5920-90b9-9cf60e4e9a22/f0dcfb7d-5aee-556e-8950-ec9cd2cc5671.webp', 'Lattafa Yara Aceite Concentrado, foto oficial de la marca', 0, 'https://lattafa-usa.com/products/yara'),
  ('9cbdb950-ae22-5c20-851d-a7033311a08d', 'risk-comete', 'b6278bd4-611c-5e94-9504-62a029020027/9cbdb950-ae22-5c20-851d-a7033311a08d.webp', 'Assaf Risk Comete, foto oficial de la marca', 0, 'https://3saf.com/en/risk-comete-143064/p421143064'),
  ('8e213c9a-df46-5fe4-b49a-c3b44e46b575', 'glitch', 'bcc8ec26-a3b1-53c0-8142-6b5f6ebea1a3/8e213c9a-df46-5fe4-b49a-c3b44e46b575.webp', 'Assaf Glitch, foto oficial de la marca', 0, 'https://3saf.com/en/glitch/p975628514'),
  ('2c518259-ede3-5d4a-ad27-5809258f8b1f', 'miss-arrogate', '43f6c1a8-1c7a-587c-b116-617c72e3c75e/2c518259-ede3-5d4a-ad27-5809258f8b1f.webp', 'Assaf Miss Arrogate, foto oficial de la marca', 0, 'https://3saf.com/en/miss-arrogate/p1676690935'),
  ('575eeb24-5623-5a62-a37a-9a0921fd70a9', 'little-garden', '3118b105-c818-5fba-9c11-3d2e449cf0bd/575eeb24-5623-5a62-a37a-9a0921fd70a9.webp', 'Laverne Little Garden, foto oficial de la marca', 0, 'https://laverne.co/products/the-little-garden-hers'),
  ('7a406db7-8e8d-5878-9eaa-30d3b104417e', 'queen-rose', '35c7ba18-08cd-554b-84d2-3e829ae427fa/7a406db7-8e8d-5878-9eaa-30d3b104417e.webp', 'Laverne Queen Rose, foto oficial de la marca', 0, 'https://laverne.co/products/queen-rose-200ml'),
  ('d86f8396-0b67-5348-9f24-5cff4dd6838e', 'bharara-king', '31325e2c-cc9b-5ad6-8991-6ca71d19b49a/d86f8396-0b67-5348-9f24-5cff4dd6838e.webp', 'Bharara King, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-king'),
  ('f430ca9d-afa5-59c2-b242-e73274839a5c', 'bharara-king', '31325e2c-cc9b-5ad6-8991-6ca71d19b49a/f430ca9d-afa5-59c2-b242-e73274839a5c.webp', 'Bharara King, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-king'),
  ('c38e7ba2-265b-5143-b61d-0d20e6a9a467', 'bharara-queen', '76f75a51-61f4-5bf8-88a3-2653dbaad416/c38e7ba2-265b-5143-b61d-0d20e6a9a467.webp', 'Bharara Queen, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-queen-eau-de-parfum-spray'),
  ('7559d78e-091c-5c9f-a633-f73f586ff5d5', 'bharara-queen', '76f75a51-61f4-5bf8-88a3-2653dbaad416/7559d78e-091c-5c9f-a633-f73f586ff5d5.webp', 'Bharara Queen, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-queen-eau-de-parfum-spray'),
  ('4b6e55d7-3215-55e2-8f86-44ead71d46bd', 'bharara-double-bleu', 'fed1dcf7-231d-50d4-b7e4-8bccc2b5d169/4b6e55d7-3215-55e2-8f86-44ead71d46bd.webp', 'Bharara Double Bleu, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-double-bleu-eau-de-parfum'),
  ('6518d0e5-376e-5219-af4d-5daa271717f7', 'bharara-double-bleu', 'fed1dcf7-231d-50d4-b7e4-8bccc2b5d169/6518d0e5-376e-5219-af4d-5daa271717f7.webp', 'Bharara Double Bleu, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-double-bleu-eau-de-parfum'),
  ('c358b903-4efe-55ed-ba8c-0c5f2c331985', 'pharaoh-ramesses-i', '1ae0e8df-f61f-5cf0-879d-fd96a74a08bc/c358b903-4efe-55ed-ba8c-0c5f2c331985.webp', 'Bharara Pharaoh Ramesses I, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramesses-i-eau-de-parfum'),
  ('07d5f97e-6404-57f5-a728-cf17c0fec05e', 'pharaoh-ramesses-i', '1ae0e8df-f61f-5cf0-879d-fd96a74a08bc/07d5f97e-6404-57f5-a728-cf17c0fec05e.webp', 'Bharara Pharaoh Ramesses I, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramesses-i-eau-de-parfum'),
  ('d8c0bd9b-ad0c-57d9-bfb7-a446904f13fa', 'pharaoh-ramesses-i', '1ae0e8df-f61f-5cf0-879d-fd96a74a08bc/d8c0bd9b-ad0c-57d9-bfb7-a446904f13fa.webp', 'Bharara Pharaoh Ramesses I, foto oficial de la marca', 2, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramesses-i-eau-de-parfum'),
  ('e54d2ac3-1679-5e80-ad23-754c6d54b80d', 'pharaoh-ramesses-ii', '05a1d25d-b25f-5b76-95e2-4c1893d0083b/e54d2ac3-1679-5e80-ad23-754c6d54b80d.webp', 'Bharara Pharaoh Ramesses II, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramasses-eau-de-parfum'),
  ('2e6fd588-0945-5bef-8762-da593b82e95b', 'pharaoh-ramesses-ii', '05a1d25d-b25f-5b76-95e2-4c1893d0083b/2e6fd588-0945-5bef-8762-da593b82e95b.webp', 'Bharara Pharaoh Ramesses II, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramasses-eau-de-parfum'),
  ('26b9cc8d-4aa8-54f7-a99c-a98e7d87cc8c', 'pharaoh-ramesses-ii', '05a1d25d-b25f-5b76-95e2-4c1893d0083b/26b9cc8d-4aa8-54f7-a99c-a98e7d87cc8c.webp', 'Bharara Pharaoh Ramesses II, foto oficial de la marca', 2, 'https://www.bhararabeauty.com/products/bharara-pharaoh-ramasses-eau-de-parfum'),
  ('0a72f4fe-dc20-5e6c-9039-04cc940c9042', 'bharara-the-collection', '9504cdb9-ad63-596b-ac51-5d3284e55122/0a72f4fe-dc20-5e6c-9039-04cc940c9042.webp', 'Bharara The Collection, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-collection-set-mini-edp-sp-w'),
  ('a82aea93-aaa5-54b4-be10-da5430245234', 'bharara-the-collection', '9504cdb9-ad63-596b-ac51-5d3284e55122/a82aea93-aaa5-54b4-be10-da5430245234.webp', 'Bharara The Collection, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-collection-set-mini-edp-sp-w'),
  ('443de0c0-f8fd-5922-9eec-7146ba59c02f', 'bharara-niche', '1ebfb35e-0a22-5b51-ab7e-cbe2866259ff/443de0c0-f8fd-5922-9eec-7146ba59c02f.webp', 'Bharara Niche, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/bharara-niche-3-4-edp'),
  ('fb1e9d34-8ad2-51d3-8948-9c67c6218497', 'bharara-niche', '1ebfb35e-0a22-5b51-ab7e-cbe2866259ff/fb1e9d34-8ad2-51d3-8948-9c67c6218497.webp', 'Bharara Niche, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/bharara-niche-3-4-edp'),
  ('2fcff32a-6ce8-5f7e-ab96-47727cc0f8dd', 'champagne-black', '21f025e9-56f4-503f-9bcf-97a2e39ffb51/2fcff32a-6ce8-5f7e-ab96-47727cc0f8dd.webp', 'Bharara Champagne Black, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/champagne-black-unisex-eau-de-parfum-3-4-fl-oz'),
  ('e063d7d2-81cb-5c7b-9f61-cbbd2d35c6b3', 'champagne-black', '21f025e9-56f4-503f-9bcf-97a2e39ffb51/e063d7d2-81cb-5c7b-9f61-cbbd2d35c6b3.webp', 'Bharara Champagne Black, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/champagne-black-unisex-eau-de-parfum-3-4-fl-oz'),
  ('cc86f906-94b8-51fa-8c19-18603b62ed1d', 'champagne-blue', '5b3010bb-1f7a-5644-8141-332377d31ead/cc86f906-94b8-51fa-8c19-18603b62ed1d.webp', 'Bharara Champagne Blue, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/champagne-blue-eau-de-parfum-3-4-fl-oz-for-men'),
  ('49d63c1d-57ec-5dc0-8cd2-7f0293bf09f8', 'champagne-blue', '5b3010bb-1f7a-5644-8141-332377d31ead/49d63c1d-57ec-5dc0-8cd2-7f0293bf09f8.webp', 'Bharara Champagne Blue, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/champagne-blue-eau-de-parfum-3-4-fl-oz-for-men'),
  ('05a46a79-b159-5aae-a381-5389920450cc', 'champagne-pink', '5ecf2072-8967-5191-97aa-6d560c952d70/05a46a79-b159-5aae-a381-5389920450cc.webp', 'Bharara Champagne Pink, foto oficial de la marca', 0, 'https://www.bhararabeauty.com/products/champagne-pink-3-4-edp-sp-w'),
  ('5d74315f-7f25-5014-983c-bea7b8eff3ea', 'champagne-pink', '5ecf2072-8967-5191-97aa-6d560c952d70/5d74315f-7f25-5014-983c-bea7b8eff3ea.webp', 'Bharara Champagne Pink, foto oficial de la marca', 1, 'https://www.bhararabeauty.com/products/champagne-pink-3-4-edp-sp-w'),
  ('0259ee9f-540a-5ff2-8634-5d6121f2326a', 'game-of-spades-blind-bid', '34c52139-eb73-556c-8826-fccf2e490872/0259ee9f-540a-5ff2-8634-5d6121f2326a.webp', 'Jo Milano Game of Spades Blind Bid, foto oficial de la marca', 0, 'https://jomilanoparis.com/products/game-of-spades-blind-bid'),
  ('5fa3f447-5dea-5cb3-bca2-6e388daa2006', 'reef-33', '18794610-9efe-5cf5-9721-1d3726190cf8/5fa3f447-5dea-5cb3-bca2-6e388daa2006.webp', 'Reef 33, foto oficial de la marca', 0, 'https://reefperfumes.com/en/Reef-33/p1243364177'),
  ('689041cb-6387-5a36-bbde-b8620e4e3540', 'reef-33', '18794610-9efe-5cf5-9721-1d3726190cf8/689041cb-6387-5a36-bbde-b8620e4e3540.webp', 'Reef 33, foto oficial de la marca', 1, 'https://reefperfumes.com/en/Reef-33/p1243364177'),
  ('f3713121-1006-5a1d-bef0-628c2a2df958', 'reef-19', 'ee91efb8-f5e6-53a5-b8e3-54d84e82ec35/f3713121-1006-5a1d-bef0-628c2a2df958.webp', 'Reef 19, foto oficial de la marca', 0, 'https://reefperfumes.com/en/Reef-19-100ml/p1994507416'),
  ('e5540fbe-ac90-5b5e-9416-6f3aeb8567a9', 'reef-19', 'ee91efb8-f5e6-53a5-b8e3-54d84e82ec35/e5540fbe-ac90-5b5e-9416-6f3aeb8567a9.webp', 'Reef 19, foto oficial de la marca', 1, 'https://reefperfumes.com/en/Reef-19-100ml/p1994507416')
) as v(id, slug, path, alt, pos, source)
join public.products p on p.slug = v.slug
on conflict (id) do nothing;
