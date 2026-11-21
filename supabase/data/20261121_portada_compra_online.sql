-- Carga de datos (no migración): el texto de la tienda en la portada deja de anunciar
-- que la compra online «llegará muy pronto», ahora que la venta está abierta (en
-- pruebas para el banco, DECISIONS §193 y §196). Es contenido del panel (Contenido →
-- Portada): se guarda y se publica como lo haría el panel, con su revisión en
-- private.store_revisions y su rastro en audit_log (sin actor). Solo cambia
-- `storeBody`, y solo si el borrador y lo publicado siguen siendo el texto de
-- siempre, para no pisar un cambio hecho en el panel. Idempotente.
-- Se puede volver atrás desde el panel con «Restaurar» en el historial de la portada.

do $$
declare
  v_doc private.store_documents;
  v_new jsonb;
begin
  for v_doc in
    select d.*
    from private.store_documents d
    join public.store_content c using (kind, locale)
    where d.kind = 'home'
      and d.payload = c.payload
      and d.revision = c.revision
      and d.payload ->> 'storeBody' in (
        'Ven a descubrir las fragancias en persona. La compra online llegará muy pronto.',
        'Vine a descobrir les fragàncies en persona. La compra en línia arribarà molt aviat.',
        'Come and discover the fragrances in person. Online shopping is coming very soon.')
    for update of d
  loop
    v_new := jsonb_set(v_doc.payload, '{storeBody}', to_jsonb(case v_doc.locale
      when 'es' then 'Ven a descubrir las fragancias en persona o cómpralas en nuestra tienda online.'
      when 'ca' then 'Vine a descobrir les fragàncies en persona o compra-les a la nostra botiga en línia.'
      else 'Come and discover the fragrances in person, or buy them in our online shop.'
    end));

    update private.store_documents
    set payload = v_new, revision = revision + 1, updated_at = now(), updated_by = null
    where kind = v_doc.kind and locale = v_doc.locale
    returning * into v_doc;

    insert into private.store_revisions (kind, locale, revision, payload, actor_id, action)
    values (v_doc.kind, v_doc.locale, v_doc.revision, v_doc.payload, null, 'save'),
           (v_doc.kind, v_doc.locale, v_doc.revision, v_doc.payload, null, 'publish');

    update public.store_content
    set payload = v_doc.payload, revision = v_doc.revision, published_at = now()
    where kind = v_doc.kind and locale = v_doc.locale;

    insert into public.audit_log (actor_id, action, entity, entity_id, after)
    values (null, 'content.saved', v_doc.kind, v_doc.locale,
            jsonb_build_object('revision', v_doc.revision)),
           (null, 'content.published', v_doc.kind, v_doc.locale,
            jsonb_build_object('revision', v_doc.revision));
  end loop;
end;
$$;
