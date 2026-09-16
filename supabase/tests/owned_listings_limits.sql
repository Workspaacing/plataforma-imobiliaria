-- =============================================================================
-- Teste dos limites de imóveis próprios e de fotos por imóvel
-- =============================================================================
-- Bloco único, sem efeito no banco: cria os dados, confere tudo e termina com
-- `raise exception` — o resultado sai na mensagem do erro (P0001) e a transação
-- inteira é desfeita. Rode no SQL Editor do projeto ou por `psql -f`.
--
-- A imobiliária de teste usa limites curtos (2 imóveis próprios, 3 fotos cada)
-- só para o corte acontecer rápido. A regra que está sendo provada:
--
--   foto no NOSSO bucket (storage_path)  → ocupa espaço, conta nos dois limites
--   foto na origem (external_url)        → não ocupa nada, não conta em nada
--
-- Resultado esperado:
--   foto_1_imovel_a                : "ok"
--   foto_3_imovel_a                : "ok"
--   foto_4_imovel_a                : "limite_photos_per_listing"
--   imovel_b_entra                 : "ok"
--   imovel_c_barrado               : "limite_owned_listings"
--   imovel_c_importado_passa       : "ok"
--   importado_nao_conta_no_imovel  : 0
--   importado_nao_conta_na_conta   : 2
--   apagar_libera_vaga             : "ok"
--   video_externo_continua_valendo : "ok"

do $$
declare
  r jsonb := '{}'::jsonb;
  u_owner uuid := gen_random_uuid();
  org uuid;
  imovel_a uuid;
  imovel_b uuid;
  imovel_c uuid;
  i integer;
  -- 'ok' quando a foto entrou; a mensagem do limite quando o gatilho barrou.
  resultado text;
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (u_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'teste-imoveis-proprios@exemplo.invalid', now(), now());

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);

  org := public.create_organization('Imobiliaria Teste Fotos', 'teste-imoveis-proprios');

  update public.billing_accounts
  set status = 'active',
      plan_key = 'imobiliaria',
      billing_interval = 'month',
      current_period_end = now() + interval '20 days',
      limits = limits || '{"owned_listings": 2, "photos_per_listing": 3}'::jsonb
  where organization_id = org;

  insert into public.properties (organization_id, title, purpose, type)
  values (org, 'Imovel A', 'sale', 'apartment') returning id into imovel_a;
  insert into public.properties (organization_id, title, purpose, type)
  values (org, 'Imovel B', 'sale', 'apartment') returning id into imovel_b;
  insert into public.properties (organization_id, title, purpose, type)
  values (org, 'Imovel C', 'sale', 'apartment') returning id into imovel_c;

  -- ---------------------------------------------------------------------------
  -- 1. Fotos por imóvel
  -- ---------------------------------------------------------------------------
  for i in 1..3 loop
    begin
      insert into public.property_media (organization_id, property_id, kind, storage_path, position)
      values (org, imovel_a, 'image',
              org::text || '/properties/' || imovel_a::text || '/a' || i || '.webp', i);
      resultado := 'ok';
    exception when others then
      resultado := sqlerrm;
    end;

    if i = 1 then
      r := r || jsonb_build_object('foto_1_imovel_a', resultado);
    elsif i = 3 then
      r := r || jsonb_build_object('foto_3_imovel_a', resultado);
    end if;
  end loop;

  begin
    insert into public.property_media (organization_id, property_id, kind, storage_path, position)
    values (org, imovel_a, 'image',
            org::text || '/properties/' || imovel_a::text || '/a4.webp', 4);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('foto_4_imovel_a', resultado);

  -- ---------------------------------------------------------------------------
  -- 2. Imóveis próprios
  -- ---------------------------------------------------------------------------
  begin
    insert into public.property_media (organization_id, property_id, kind, storage_path, position)
    values (org, imovel_b, 'image',
            org::text || '/properties/' || imovel_b::text || '/b1.webp', 1);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('imovel_b_entra', resultado);

  begin
    insert into public.property_media (organization_id, property_id, kind, storage_path, position)
    values (org, imovel_c, 'image',
            org::text || '/properties/' || imovel_c::text || '/c1.webp', 1);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('imovel_c_barrado', resultado);

  -- ---------------------------------------------------------------------------
  -- 3. Foto importada: entra mesmo com os dois limites cheios, e não conta
  -- ---------------------------------------------------------------------------
  begin
    insert into public.property_media (organization_id, property_id, kind, external_url, position)
    values (org, imovel_c, 'image', 'https://origem.invalid/fotos/c1.jpg', 1);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('imovel_c_importado_passa', resultado);

  r := r || jsonb_build_object(
    'importado_nao_conta_no_imovel', private.owned_photo_count(imovel_c),
    'importado_nao_conta_na_conta', private.owned_listing_count(org));

  -- ---------------------------------------------------------------------------
  -- 4. Apagar foto devolve a vaga
  -- ---------------------------------------------------------------------------
  delete from public.property_media
  where property_id = imovel_a
    and storage_path = org::text || '/properties/' || imovel_a::text || '/a3.webp';

  begin
    insert into public.property_media (organization_id, property_id, kind, storage_path, position)
    values (org, imovel_a, 'image',
            org::text || '/properties/' || imovel_a::text || '/a5.webp', 5);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('apagar_libera_vaga', resultado);

  -- ---------------------------------------------------------------------------
  -- 5. Vídeo externo não foi afetado pela mudança da restrição
  -- ---------------------------------------------------------------------------
  begin
    insert into public.property_media (organization_id, property_id, kind, external_url, position)
    values (org, imovel_c, 'video', 'https://youtu.be/exemplo', 2);
    resultado := 'ok';
  exception when others then
    resultado := sqlerrm;
  end;
  r := r || jsonb_build_object('video_externo_continua_valendo', resultado);

  raise exception using errcode = 'P0001', message = jsonb_pretty(r);
end;
$$;
