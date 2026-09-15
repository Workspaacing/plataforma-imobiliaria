# Banco de dados (Supabase)

Schema da Entrega 1: multi-imobiliária por `organization_id`, RLS em todas as tabelas de `public` e funções de autorização no schema `private` (não exposto na API).

- Projeto: `qwaywbtyfkovulvirujp` (Postgres 17, sa-east-1)
- Extensões usadas (schema `extensions`): `pgcrypto` (tokens, SHA-256) e `unaccent` (match sem acentos); Supabase Vault (`vault`) guarda as chaves do servidor da captação (`capture_server_key`) e das landing pages (`lead_server_key`)

## Migrações aplicadas

Os nomes dos arquivos usam a mesma versão registrada no histórico do projeto remoto (`supabase_migrations.schema_migrations`), para a CLI não tentar reaplicá-las.

| Versão         | Arquivo                               | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20260915054812 | `foundation`                          | schema `private`, funções utilitárias e todos os enums                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 20260915054907 | `base`                                | `organizations`, `profiles` (trigger em `auth.users`), `memberships`, `invitations`, `audit_events`, `private.is_member/has_role`, RPCs `create_organization` e `accept_invitation`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 20260915054939 | `clients`                             | `clients`, `client_shares`, `client_interests`, `client_documents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 20260915055058 | `properties`                          | `condominiums`, `properties` (código `IMV-000001` por imobiliária, imutável), `property_media`, `property_owners`, `keys`, `key_movements`, `proposals`, `listing_authorizations`, `capture_requests`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20260915055123 | `agenda`                              | `activities`, `appointments`, `tasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20260915055244 | `rls_policies`                        | `private.can_access_client`, `private.can_edit_property` e as políticas RLS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 20260915055326 | `views_and_rpcs`                      | view `client_property_matches`, RPCs `submit_capture_request` e `log_access_event`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 20260915055343 | `audit_triggers`                      | auditoria de insert/update/delete em `clients`, `client_documents`, `properties`, `memberships`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 20260915055406 | `storage`                             | buckets e políticas do Storage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 20260915055450 | `hardening`                           | convites visíveis só a dono/gerente; validação de membros ativos; `unaccent` no match; `organizations.feed_token`, RPCs `rotate_feed_token` e `get_portal_feed`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 20260915055727 | `advisor_fixes`                       | RLS habilitado em `private.organization_counters`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20260915060618 | `public_organization_profile`         | RPC `get_public_organization` (perfil público da imobiliária para o formulário `/captar/[slug]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 20260915064425 | `invitation_preview`                  | RPC `get_invitation_preview` (prévia do convite para a tela pública `/convite/[token]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20260915072442 | `security_hardening_2`                | auditoria de segurança (C1 + revisão do app C2): vínculo de proprietário exige acesso ao cliente; sem INSERT direto em `memberships`; convite exige e-mail confirmado e não reativa dono desativado; gerente só lê convites da equipe operacional; autor (`created_by`/`uploaded_by`) definido pelo banco; `key_movements` e `proposals` com checagens e grants por coluna; fluxo de status de propostas; `feed_token` fora do SELECT + RPC `get_feed_settings`; feed respeita `address_display`; `submit_capture_request` com chave do servidor (Vault), nonce e limite por visitante; sem TRUNCATE/TRIGGER/REFERENCES para `anon`/`authenticated`                                                                                                                                                                                                                                                                                                  |
| 20260915072935 | `security_hardening_2_followup`       | trocar o cliente de tarefa/visita exige acesso a ele; autor apaga o próprio upload órfão em `client-documents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 20260915075742 | `landing_pages_and_leads`             | enums `landing_template`, `landing_status`, `lead_stage`, `lead_source`; tabelas `landing_pages` e `leads`; bucket `landing-assets`; RPCs públicas `get_public_landing_page` e `submit_landing_lead` (segredo `lead_server_key` no Vault, nonce, limites); `private.landing_lead_attempts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 20260915080841 | `landing_pages_and_leads_followup`    | RPC `lead_duplicate_flags` (sinal de duplicado sem expor o registro) e índices de telefone/e-mail em `clients`; `leads.position` com default `null`; auditoria de `leads` (trigger) e `log_access_event('lead', ...)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20260915081827 | `subdomain_slug_and_profile_backfill` | slug da imobiliária como subdomínio: `organizations.slug` rótulo DNS válido e não reservado (CHECKs), `private.is_reserved_subdomain`, `create_organization` recusa endereço reservado; `handle_new_user` trunca `full_name` em 160; backfill idempotente de `profiles` (`private.backfill_profiles`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20260915083911 | `leads_manual_consent`                | cadastro manual de lead grava `consent_at` (INSERT liberado para `authenticated`); CHECK `leads_consent_at_not_future` (tolerância de 5 minutos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 20260915090851 | `scheduled_maintenance`               | habilita `pg_cron`; funções `private.cleanup_expired_nonces`, `private.cleanup_stale_rate_limit_attempts` e `private.cleanup_expired_invitations`; jobs `limpeza-nonces-e-tentativas` e `limpeza-convites-expirados` (ver "Manutenção agendada" abaixo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20260915095338 | `notification_recipients`             | e-mail transacional: RPC `get_notification_recipients(p_server_key, p_organization_id, p_kind, p_subject_id)` (anon/authenticated só com o segredo `notification_server_key` do Vault, env `NOTIFICATION_SERVER_KEY`; `42501` chave, `22023` tipo/registro) devolve só `email` (de `auth.users`, confirmado) e `full_name`, até 20: `new_lead` = responsável ativo ou donos/gerentes; `capture_request` = donos/gerentes/captadores. Org nula = a do registro; lead aceita `event_id` de até 15 min. Regra em `private.notification_recipients`; índice `leads_event_id_idx`. Sem tabela nova (bloqueios ficam na Brevo)                                                                                                                                                                                                                                                                                                                             |
| 20260915102131 | `billing_accounts`                    | assinatura: public.billing_accounts (1 linha por imobiliária, criada por trigger + backfill); estado trialing/active/grace/read_only igual ao core; modo leitura (a0_billing_writable, P0001 assinatura_somente_leitura); limites users/landing_pages (a1_billing_limit, limite_usuarios/limite_landing_pages); RPC get_billing_overview; RPCs com billing_server_key: sync_billing_account, get_billing_account_ids, list_billing_reminders                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 20260915103632 | `billing_read_only_feed_storage`      | modo leitura: `get_portal_feed` pausa com erro P0001 `assinatura_somente_leitura` (detail `portal_feed`; app responde 503) só após slug/token válidos; helper `private.storage_org_writable` (authenticated; true só para membro ativo fora do read_only); INSERT/UPDATE com sessão em property-media, client-documents e landing-assets bloqueados no read_only (SELECT/DELETE seguem)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 20260915104743 | `billing_trial_ai_conversations`      | teste grátis com 10 conversas de IA: `private.billing_trial_defaults` redefinida (demais limites e recursos iguais); vale só para imobiliárias novas, sem alterar `billing_accounts` existentes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 20260915112227 | `storage_savings`                     | economia de armazenamento: buckets `property-media` 2 MB (jpeg/webp), `landing-assets` 2 MB (jpeg/png/webp) e `client-documents` 10 MB (tipos mantidos), CHECK `client_documents.size_bytes` até 10 MB (aborta se houver objeto fora dos novos limites); trigger `a1_property_photo_limit` em `property_media` (até 20 linhas `kind = 'image'` por imóvel; P0001 `limite_fotos_imovel`, detail `{"limit": 20, "usage": n}`; miniaturas não são linhas e não contam); auditoria de `leads` ignora update em que só mudou `position`; `private.cleanup_old_audit_events` (180 dias; acessos de `log_access_event` 5 anos) e `private.cleanup_old_cron_run_details` (14 dias) com jobs semanais `retencao-auditoria` e `limpeza-historico-cron`; `private.list_orphan_storage_objects(p_limit)` só leitura                                                                                                                                              |
| 20260915151929 | `referral_program`                    | Indique e ganhe: `organizations.referral_code` (8 caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, gerado pelo banco com `private.new_referral_code`, único, imutável) e `organizations.referred_by_organization_id` (1ª atribuição, só por `create_organization`; imutável por trigger `organizations_protect_referral`; sem grant de SELECT/UPDATE para sessões); `billing_accounts.first_paid_at` e `billing_accounts.referral_discount_percent` (0 a 100; SELECT só desta coluna para `authenticated`); `create_organization(..., p_referral_code)` com antifraude `private.referral_attribution_blocked`; nome mascarado `private.mask_referral_name`; RPCs com `billing_server_key`: `record_billing_first_payment`, `get_referral_state`, `set_referral_discount_percent`, `list_referral_grace_completions` (ver "Indique e ganhe")                                                                                                          |
| 20260915155948 | `referral_program_hardening`          | Indique e ganhe (revisão): `billing_accounts.plan_net_monthly_cents`/`plan_net_invoice_at` (valor líquido do plano na última fatura paga, trava do desconto), `referral_counted_at` (transição que gera o aviso de perda), `referral_confirmed_notified_at` (reserva do aviso de confirmação), `referral_ineligible_at`/`referral_ineligible_reason` (estorno/disputa); máscara de nome só com iniciais quando pode ser de pessoa; CNPJ igual bloqueia a atribuição; membros em comum (inclusive inativos) e CNPJ igual reavaliados em `get_referral_state`; `record_billing_invoice_paid` substitui `record_billing_first_payment`; `apply_referral_recalculation` (percentual esperado + transições) substitui `set_referral_discount_percent`; novas `set_referral_confirmation_notice`, `set_referral_ineligibility`, `list_referral_referrers`; `list_referral_grace_completions` paginada; `get_referral_state` com até 1000 indicadas e total |

## RPCs públicas

| Função                                                                                          | Quem executa                                     | Retorno                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_organization(p_name, p_slug, p_legal_name?, p_cnpj?, p_creci?, p_city?, p_state?)`      | authenticated                                    | `uuid` da imobiliária; cria a membership `owner`. Não existe INSERT direto em `organizations` nem em `memberships`. O slug vira o subdomínio (ver "Subdomínio da imobiliária"). Erros de slug (`22023`): `Endereço inválido: use de 3 a 60 letras minúsculas, números e hífens.` / `Este endereço é reservado. Escolha outro.`; em uso: `23505`.                               |
| `accept_invitation(p_token)`                                                                    | authenticated                                    | `uuid` da imobiliária; valida token, validade, e-mail do usuário e **e-mail confirmado**. Erros: `P0002` convite inválido/usado, `22023` expirado, `42501` com mensagem `Este convite foi enviado para outro e-mail.` ou `Confirme seu e-mail antes de aceitar o convite.` (diferencie pela mensagem). Dono ativo continua dono; dono desativado volta com o papel do convite. |
| `submit_capture_request(org_slug, payload, p_server_key, p_nonce, p_client_key?)`               | anon, authenticated (só com a chave do servidor) | `uuid` da captação. Contrato completo abaixo.                                                                                                                                                                                                                                                                                                                                  |
| `log_access_event(p_entity, p_entity_id, p_action?)`                                            | authenticated                                    | registra leitura/download/exportação/impressão de dado sensível (LGPD). Entidades: `clients`, `client_documents`, `properties` e `lead` (ou `leads`; gravada como `leads`, exige poder ver o lead). Ações: `view`, `download`, `export`, `print`. Erros: `22023` entidade/ação inválida, `P0002` registro inexistente ou sem acesso.                                           |
| `rotate_feed_token(p_organization_id)`                                                          | authenticated (só dono)                          | novo `feed_token`.                                                                                                                                                                                                                                                                                                                                                             |
| `get_feed_settings(p_organization_id)`                                                          | authenticated (dono ou gerente ativos)           | `jsonb` `{ "slug": text, "feed_token": text }`. Demais papéis e não membros: erro `42501` (`Só o dono ou o gerente da imobiliária podem ver o endereço do feed.`). É a única forma de o app ler o `feed_token`.                                                                                                                                                                |
| `get_portal_feed(p_org_slug, p_token)`                                                          | anon, authenticated                              | `jsonb` com `organization` e `properties` ativos e publicados (com `media` ordenada por `position`); `null` se slug ou token não conferem. Endereço conforme `address_display`: `full` traz tudo; `street` omite as chaves `street_number`, `complement`, `latitude`, `longitude`; `neighborhood` omite também `street`.                                                       |
| `get_public_organization(p_slug)`                                                               | anon, authenticated                              | `jsonb` com `name`, `city`, `state`, `phone`, `email`, `creci` e `brand` da imobiliária (sem `id`, `cnpj`, `feed_token` ou `created_by`); `null` se o slug não existir. Usada pelo formulário público de captação `/captar/[slug]`.                                                                                                                                            |
| `get_invitation_preview(p_token)`                                                               | anon, authenticated                              | `jsonb` com `organization_name`, `role`, `expires_at`, `expired`, `accepted` e `email_hint` (e-mail convidado mascarado, ex.: `ma***@gmail.com`); `null` se o token não existir. Nunca expõe `id`, `token` ou `organization_id`. Usada pela tela pública `/convite/[token]` antes do aceite.                                                                                   |
| `lead_duplicate_flags(p_lead_ids)`                                                              | authenticated                                    | `table (lead_id uuid, has_duplicate boolean)` só para os leads que o usuário vê; indica se há outro lead ou cliente da mesma imobiliária (90 dias) com o mesmo telefone ou e-mail, sem expor o duplicado. Contrato abaixo.                                                                                                                                                     |
| `get_public_landing_page(p_org_slug, p_page_slug)`                                              | anon, authenticated                              | `jsonb` da landing page **publicada** (imóveis ativos, endereço só até o bairro, sem proprietário); `null` se a imobiliária ou a página não existirem ou a página não estiver publicada. Contrato abaixo.                                                                                                                                                                      |
| `submit_landing_lead(p_org_slug, p_page_slug, p_payload, p_server_key, p_nonce, p_client_key?)` | anon, authenticated (só com a chave do servidor) | `void`; cria o lead. Contrato completo abaixo.                                                                                                                                                                                                                                                                                                                                 |

A URL do feed para os portais inclui o `feed_token` da imobiliária; o app chama `get_portal_feed` com a chave anon, sem `service_role`.

No modo leitura da assinatura o feed não devolve XML vazio (que faria os portais desativarem os anúncios): a RPC levanta P0001 `assinatura_somente_leitura` com detail `portal_feed` e a rota responde 503 + `Retry-After`, então os portais mantêm a última carga. Uploads (INSERT/UPDATE) nos 3 buckets são recusados por RLS no modo leitura; leitura e remoção continuam.

### Contrato de `submit_capture_request`

```sql
public.submit_capture_request(
  org_slug     text,
  payload      jsonb,
  p_server_key text default null,  -- obrigatório na prática
  p_nonce      text default null,  -- obrigatório na prática
  p_client_key text default null   -- opcional
) returns uuid
```

Chamada pelo servidor Next (Server Action) com a chave publishable/anon:

```ts
await supabase.rpc("submit_capture_request", {
  org_slug: slug,
  payload, // mesmo formato de antes
  p_server_key: process.env.CAPTURE_SERVER_KEY,
  p_nonce: crypto.randomUUID(), // novo a cada envio
  p_client_key: visitorHash, // opcional: HMAC-SHA256(IP) em hex
})
```

- `payload`: `owner_name` (obrigatório, 2 a 120), `owner_email` e/ou `owner_phone` (ao menos um), `purpose` (`sale`, `rent`, `sale_rent`), `type`, `postal_code`, `neighborhood`, `city`, `state`, `expected_price` (`"750000.00"`), `message` (até 2.000), `consent: true` (LGPD). Até 16 KB. O e-mail é validado de forma estrita (sem espaços, quebras de linha, `?`, `&` ou `..`; domínio com TLD).
- `p_server_key`: valor do segredo `capture_server_key` do Vault. Fica só no servidor (`CAPTURE_SERVER_KEY` no `.env.local`/variáveis da Vercel), nunca no browser.
- `p_nonce`: 16 a 512 caracteres visíveis (sem espaço), novo por envio. Só é consumido quando o envio é aceito (erro de validação não o gasta); não pode se repetir em 12 h. O banco guarda só o SHA-256.
- `p_client_key`: hash do visitante calculado pelo app (nunca o IP em claro), 32 a 128 caracteres `[A-Za-z0-9_=+/-]` (hex ou base64url). O banco guarda só esse valor, por até 1 dia.
- Limites: 30 envios por minuto por imobiliária (todos os envios) e 5 envios a cada 10 minutos por `p_client_key` na mesma imobiliária. Envios da mesma imobiliária são serializados (advisory lock), então os limites valem com requisições simultâneas.

Erros (`code` do PostgREST):

| Código  | Quando                                                                                                                                               | Mensagem                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `42501` | chave do servidor ausente/errada, nonce ausente/inválido/repetido (sempre a mesma, sem indicar o motivo; é verificado antes de qualquer outra coisa) | `Não foi possível enviar o formulário.`                                                                                                                      |
| `22023` | validação do payload ou `p_client_key` com formato inválido                                                                                          | mensagem pt-BR pronta para exibir                                                                                                                            |
| `P0002` | slug não existe                                                                                                                                      | `Imobiliária não encontrada.`                                                                                                                                |
| `54000` | limite atingido; `details` = `organization` ou `client_key`                                                                                          | `Muitas solicitações em pouco tempo. Tente novamente em instantes.` / `Você enviou muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo.` |

Ler e trocar a chave do servidor (SQL Editor ou MCP `execute_sql`, com usuário administrador; nunca pela API):

```sql
-- valor para CAPTURE_SERVER_KEY
select decrypted_secret from vault.decrypted_secrets where name = 'capture_server_key';

-- rotação (atualize a variável do servidor logo em seguida)
select vault.update_secret(
  (select id from vault.secrets where name = 'capture_server_key'),
  encode(extensions.gen_random_bytes(32), 'hex')
);
```

### Contrato de `get_public_landing_page`

```sql
public.get_public_landing_page(p_org_slug text, p_page_slug text) returns jsonb
```

Slugs sem diferença de maiúsculas/espaços nas pontas. Retorna `null` se a imobiliária não existir, a página não existir ou não estiver `published`.

```jsonc
{
  "page": { "id", "template", "slug", "name", "theme", "content", "tracking", "seo", "published_at" },
  "organization": { "name", "city", "state", "phone", "email", "creci", "brand" },
  "properties": [{
    "id", "code", "title", "purpose", "type", "sale_price", "rent_price", "condo_fee",
    "living_area", "lot_area", "bedrooms", "suites", "bathrooms", "parking_spaces",
    "neighborhood", "city", "state", "features",
    "cover_path",   // imagem de capa (is_cover) ou a primeira imagem; null sem imagens
    "media_paths"   // até 6 imagens, ordenadas por position (vídeos/tours não entram)
  }],
  "broker": { "full_name", "creci_number", "creci_state", "avatar_url", "phone" } // ou null
}
```

- `properties`: só imóveis `active`, na ordem de `property_ids`; ids de imóveis excluídos ou inativos são ignorados. Nunca traz rua, número, complemento, CEP, coordenadas, dados de proprietário, `captured_by`/`broker_id` nem `address_display`. Os caminhos são do bucket público `property-media`.
- `broker`: só no modelo `portfolio_broker`, com o perfil de `lead_assignee_id` **se ele ainda for membro ativo**; caso contrário `null`.
- `tracking` já vem normalizado pelo banco (sem chaves vazias; IDs do Google em maiúsculas).

### Contrato de `submit_landing_lead`

```sql
public.submit_landing_lead(
  p_org_slug   text,
  p_page_slug  text,
  p_payload    jsonb,
  p_server_key text default null,  -- obrigatório na prática
  p_nonce      text default null,  -- obrigatório na prática
  p_client_key text default null   -- opcional
) returns void
```

Chamada pelo servidor Next (Server Action) com a chave publishable/anon:

```ts
const { error } = await supabase.rpc("submit_landing_lead", {
  p_org_slug: orgSlug,
  p_page_slug: pageSlug,
  p_payload: {
    name,
    email,
    phone,
    message, // email e/ou phone
    property_id, // opcional; precisa estar em property_ids da página
    interest, // opcional: buy | rent | invest | sell | info
    typology, // opcional, até 80
    utm: { source, medium, campaign, content, term },
    click_ids: { gclid, gbraid, wbraid, fbclid, fbc, fbp },
    landing_url,
    referrer, // http(s)
    event_id, // uuid; o mesmo usado no Pixel/CAPI (deduplicação)
    consent: true,
  },
  p_server_key: process.env.LEAD_SERVER_KEY,
  p_nonce: crypto.randomUUID(), // novo a cada chamada (inclusive em retentativas)
  p_client_key: visitorHash, // opcional: HMAC-SHA256(IP) em hex
})
```

- Cria o lead com `source = 'landing_page'`, `stage = 'new'`, `landing_page_id` da página, `assigned_to = lead_assignee_id` da página (ou `null` se o responsável não for mais membro ativo) e `consent_at = now()`.
- `p_payload` (até 16 KB):
  - `name`: obrigatório, 2 a 120 (aparado).
  - `email` e/ou `phone`: ao menos um. E-mail estrito (minúsculas; sem espaços, quebras de linha, `?`, `&` ou `..`; domínio com TLD). Telefone: só dígitos são guardados, 10 a 13.
  - `message`: até 2.000. `interest`: `buy`, `rent`, `invest`, `sell` ou `info`. `typology`: até 80.
  - `property_id`: uuid que esteja em `property_ids` da página e exista na imobiliária.
  - `event_id`: uuid. **Repetido na mesma imobiliária → o envio é ignorado sem erro** (idempotência; o nonce é consumido e nada é gravado).
  - `utm` / `click_ids`: só as chaves listadas são guardadas (as outras são descartadas), valores texto/número aparados e cortados em 150 (utm) / 255 (click_ids); não geram erro.
  - `landing_url` / `referrer`: guardados só se começarem com `http://` ou `https://` e não tiverem espaços/caracteres de controle (cortados em 500); senão viram `null` sem erro.
  - `consent`: precisa ser `true`.
- `p_server_key`: valor do segredo `lead_server_key` do Vault (diferente da chave da captação). Só no servidor (`LEAD_SERVER_KEY`), nunca no browser.
- `p_nonce`: 16 a 512 caracteres visíveis, novo por chamada. Só é consumido quando o envio é aceito (erro de validação ou de limite não o gasta); não pode se repetir em 12 h. A tabela de nonces (`private.capture_request_nonces`, só SHA-256) é compartilhada com `submit_capture_request`: um nonce já usado em qualquer uma das duas é recusado nas duas.
- `p_client_key`: hash do visitante, 32 a 128 caracteres `[A-Za-z0-9_=+/-]`. O banco guarda só esse valor, por até 1 dia (`private.landing_lead_attempts`).
- Limites (separados dos da captação): **60 envios por minuto por imobiliária** e **5 envios a cada 10 minutos por `p_client_key`** na mesma imobiliária. Envios da mesma imobiliária são serializados (advisory lock).
- Ordem das verificações: chave/nonce → formato do payload e de `p_client_key` → página → campos → trava → `event_id` repetido → limites → consumo do nonce → gravação.

Erros (`code` do PostgREST):

| Código  | Quando                                                                                                                                                                                                               | Mensagem                                                                                                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `42501` | chave do servidor ausente/errada, nonce ausente/inválido/repetido (sempre a mesma, sem indicar o motivo; verificado antes de tudo)                                                                                   | `Não foi possível enviar o formulário.`                                                                                                                                                                                                                                                            |
| `22023` | payload não é objeto ou passa de 16 KB, `p_client_key` inválido, nome, contato, e-mail, telefone, mensagem, interesse, tipologia, `property_id` (fora da página/inexistente), `event_id` não uuid, sem consentimento | mensagem pt-BR pronta para exibir (ex.: `Informe seu nome (2 a 120 caracteres).`, `Informe um e-mail ou telefone para contato.`, `E-mail inválido.`, `Telefone inválido: informe DDD e número.`, `Imóvel inválido para esta página.`, `É necessário aceitar o uso dos dados para contato (LGPD).`) |
| `P0002` | imobiliária ou página inexistente, ou página não publicada                                                                                                                                                           | `Página não encontrada.`                                                                                                                                                                                                                                                                           |
| `54000` | limite atingido; `details` = `organization` ou `client_key`                                                                                                                                                          | `Muitas solicitações em pouco tempo. Tente novamente em instantes.` / `Você enviou muitos contatos em pouco tempo. Aguarde alguns minutos e tente de novo.`                                                                                                                                        |

Ler e trocar a chave (SQL Editor ou MCP `execute_sql`, com usuário administrador; nunca pela API):

```sql
-- valor para LEAD_SERVER_KEY
select decrypted_secret from vault.decrypted_secrets where name = 'lead_server_key';

-- rotação (atualize a variável do servidor logo em seguida)
select vault.update_secret(
  (select id from vault.secrets where name = 'lead_server_key'),
  encode(extensions.gen_random_bytes(32), 'hex')
);
```

### Contrato de `lead_duplicate_flags`

```sql
public.lead_duplicate_flags(p_lead_ids uuid[])
  returns table (lead_id uuid, has_duplicate boolean)
```

```ts
const { data } = await supabase.rpc("lead_duplicate_flags", { p_lead_ids: ids })
// data: { lead_id: string; has_duplicate: boolean }[]
```

- Só `authenticated` (anon não executa). `security definer`, `stable`.
- Considera apenas os ids que o usuário **pode ver** (mesma regra do SELECT de `leads`, via `private.can_access_lead_row`); ids invisíveis, de outra imobiliária ou inexistentes simplesmente não aparecem no resultado.
- `has_duplicate = true` quando existe, **na mesma imobiliária e criado nos últimos 90 dias**:
  - outro lead com o mesmo telefone (últimos 11 dígitos) ou o mesmo e-mail (sem diferença de maiúsculas/espaços); ou
  - um cliente com o mesmo telefone (`phone` **ou** `whatsapp`, só dígitos, últimos 11) ou o mesmo e-mail. O cliente já vinculado ao próprio lead (`client_id`) não conta.
- Nunca devolve id, nome, contato ou responsável do registro duplicado.
- Até 1.000 ids por chamada. Lista vazia ou `null` → nenhum resultado.
- Erros: `42501` sem sessão (`É preciso estar autenticado.`); `22023` acima de 1.000 ids (`Envie no máximo 1.000 leads por consulta.`).
- Índices usados: `leads (organization_id, right(phone, 11))`, `leads (organization_id, lower(email))`, `clients (organization_id, right(regexp_replace(phone, '[^0-9]', '', 'g'), 11))`, idem para `whatsapp`, e `clients (organization_id, lower(btrim(email)))`.

## Landing pages e funil de leads

### Enums

| Enum               | Valores                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing_template` | `campaign_spotlight`, `campaign_offer`, `campaign_valuation`, `launch_showcase`, `launch_waitlist`, `launch_units`, `portfolio_grid`, `portfolio_agency`, `portfolio_broker` |
| `landing_status`   | `draft`, `published`, `archived`                                                                                                                                             |
| `lead_stage`       | `new`, `contacted`, `qualified`, `visit_scheduled`, `proposal`, `won`, `lost`                                                                                                |
| `lead_source`      | `landing_page`, `portal`, `website`, `social`, `referral`, `manual`, `other`                                                                                                 |

### `landing_pages`

Colunas: `id`, `organization_id`, `template`, `name` (1 a 120), `slug` (3 a 60, único por imobiliária), `status` (default `draft`), `published_at`, `theme`, `content`, `property_ids uuid[]` (até 12), `tracking`, `seo`, `lead_assignee_id`, `created_by`, `created_at`, `updated_at`.

- **Acesso**: SELECT por membros ativos; INSERT/UPDATE/DELETE por `owner`, `manager` e `assistant`.
- **Grants**: INSERT só de `id, organization_id, template, name, slug, status, theme, content, property_ids, tracking, seo, lead_assignee_id` (o `id` pode ser gerado pelo editor antes de salvar, para montar o caminho das imagens); UPDATE só de `template, name, slug, status, theme, content, property_ids, tracking, seo, lead_assignee_id`. `published_at` e `created_by` são do banco.
- **Normalização**: `name` aparado; `slug` em minúsculas e aparado (formato `^[a-z0-9]+(-[a-z0-9]+)*$`: sem hífen nas pontas nem hífens seguidos; é o caminho da página dentro do subdomínio da imobiliária); `tracking` sem chaves vazias/nulas, valores aparados, `google_tag_id`/`gtm_container_id` em maiúsculas.
- **Validações** (erro `23514`, mensagem pt-BR; formato e tamanho também por CHECK):
  - `theme`: `primary_color`, `secondary_color`, `accent_color` em hexadecimal (`#RGB`, `#RRGGBB` ou `#RRGGBBAA`); `background_image_path`, `logo_path` e cada item de `banner_image_paths` (lista, até 10) precisam ser caminhos da própria imobiliária (`{organization_id}/...`, `[A-Za-z0-9/_.-]`, sem `..`, até 300). Até 8 KB.
  - `content`: `whatsapp_number` só dígitos (10 a 15); `countdown_until` `AAAA-MM-DD` ou data/hora ISO; `units_left` inteiro; `highlights`, `social_proof`, `testimonials` e `launch.typologies` listas de até 30 itens; `launch` objeto. Até 32 KB.
  - `tracking`: só `meta_pixel_id` (`^[0-9]{5,20}$`), `google_tag_id` (`^(G|GT|AW)-[A-Z0-9]+$`) e `gtm_container_id` (`^GTM-[A-Z0-9]+$`); qualquer outra chave é recusada. Até 1 KB.
  - `seo`: `title` até 70, `description` até 160, `og_image_path` caminho da própria imobiliária. Até 4 KB.
  - `property_ids`: até 12, sem repetição, imóveis da própria imobiliária (checado nos ids adicionados; um imóvel excluído depois não trava a edição).
  - `lead_assignee_id`: membro ativo da imobiliária.
- **Publicação**: ao entrar em `published`, `published_at = now()`. Publicar (ou mudar modelo, imóveis ou headline de página publicada) exige `content.headline` preenchido e, em `campaign_spotlight` e `portfolio_grid`, ao menos 1 imóvel `active` em `property_ids` (`portfolio_broker` pode ficar sem imóveis). Mensagens: `Informe o título principal da página antes de publicar.` / `Selecione ao menos um imóvel ativo antes de publicar esta página.`
- Slug repetido na mesma imobiliária: `23505` (`landing_pages_organization_slug_key`).

### `leads`

Colunas: `id`, `organization_id`, `name` (2 a 120), `email`, `phone`, `message` (até 2.000), `interest` (`buy`, `rent`, `invest`, `sell`, `info`), `source` (default `manual`), `landing_page_id`, `property_id`, `client_id`, `stage` (default `new`), `position numeric` (default `null`: lead novo, manual ou público, fica no topo da coluna; o app ordena nulos primeiro), `assigned_to`, `utm`, `click_ids`, `landing_url` (até 500), `referrer` (até 500), `event_id` (único por imobiliária quando não nulo), `typology` (até 80), `consent_at`, `lost_reason` (até 500), `last_contact_at`, `created_by`, `created_at`, `updated_at`.

Índices: `(organization_id, stage, position)`, `(organization_id, assigned_to)`, `(organization_id, landing_page_id)`, `(organization_id, right(phone, 11))`, `(organization_id, lower(email))`, além dos das FKs e do único parcial `(organization_id, event_id)`.

- **Acesso**:

  | Papel                 | Lê                                 | Cria                          | Edita                                                                                                        | Remove |
  | --------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
  | `owner`, `manager`    | todos                              | sim                           | todos                                                                                                        | sim    |
  | `assistant`           | todos                              | sim                           | todos                                                                                                        | não    |
  | `broker`              | atribuídos a ele e sem responsável | só sem responsável ou para si | atribuídos a ele e sem responsável; pode assumir (`assigned_to` = ele) e não pode repassar para outra pessoa | não    |
  | `capturer`, `finance` | atribuídos a ele                   | não                           | não                                                                                                          | não    |

- **Grants**: INSERT só de `organization_id, name, email, phone, message, interest, source, property_id, client_id, stage, position, assigned_to, typology, lost_reason, last_contact_at, consent_at`; UPDATE só de `stage, position, assigned_to, lost_reason, last_contact_at, client_id, name, email, phone, message, interest, property_id` (sem `consent_at`). `utm`, `click_ids`, `landing_url`, `referrer`, `event_id` e `landing_page_id` vêm só de `submit_landing_lead`.
- **Consentimento (LGPD)**: no cadastro manual (ex.: atendimento por telefone) o app informa `consent_at`; data futura é recusada (tolerância de 5 minutos para diferença de relógio) com `23514` `A data do consentimento não pode estar no futuro.` (CHECK `leads_consent_at_not_future` também vale para gravações diretas). `submit_landing_lead` grava `consent_at = now()`.
- **Normalização e regras** (erro `23514`, mensagem pt-BR): e-mail em minúsculas e estrito (`E-mail inválido.`); telefone guardado só com dígitos, 10 a 13 (`Telefone inválido: informe DDD e número.`); `name`, `message`, `typology`, `lost_reason` aparados (vazio vira `null`).
  - `stage = 'lost'` exige `lost_reason` (`Informe o motivo da perda do lead.`).
  - Ao sair de `new` (ou criar fora de `new`) com `last_contact_at` nulo, o banco preenche `now()`.
  - `assigned_to` precisa ser membro ativo (`O responsável pelo lead precisa ser um membro ativo desta imobiliária.`).
  - `client_id` novo ou alterado exige acesso ao cliente (`42501`, `Você não tem acesso ao cliente escolhido.`).
  - `landing_page_id`, `property_id` e `client_id` com FK composta (mesma imobiliária); ao excluir o pai, a coluna vira `null`.
- **Auditoria (LGPD)**: o trigger `leads_audit` registra insert/update/delete em `audit_events` com `entity = 'leads'`; no update guarda só os nomes dos campos alterados. Update em que só mudou `position` (reordenar o card no funil, na mesma etapa) não gera evento; mudança de etapa gera (com `position` entre os campos, se mudou junto). Leituras pelo app: `log_access_event('lead', lead_id, 'view' | 'download' | 'export' | 'print')`, gravado como `entity = 'leads'` e só para lead que o usuário vê (senão `P0002`). Leads de `submit_landing_lead` ficam com `actor_id` nulo.
- **Duplicados**: `lead_duplicate_flags` (contrato acima) sinaliza lead ou cliente com o mesmo telefone/e-mail sem expor o registro.

### Desvios do contrato combinado (por segurança)

- `slug` da página no formato `^[a-z0-9]+(-[a-z0-9]+)*$` (sem hífen no início/fim nem hífens seguidos).
- `theme`: cores só hexadecimais e caminhos de imagem só da própria imobiliária (os valores vão para CSS/URLs da página pública). `content`: `whatsapp_number`, `countdown_until`, `units_left` e listas com formato/limite. `tracking` recusa chaves extras (os IDs vão para scripts). Limites de tamanho: `theme` 8 KB, `content` 32 KB, `tracking` 1 KB, `seo` 4 KB.
- `published_at` não é gravável pelo app; o banco preenche ao publicar.
- `leads`: `lost_reason` até 500; `landing_url`/`referrer` só http(s); INSERT manual sem as colunas de atribuição de campanha (`consent_at` foi liberado depois, a pedido do funil, com a regra de data não futura); vincular `client_id` exige acesso ao cliente.
- `submit_landing_lead`: `p_server_key`, `p_nonce` e `p_client_key` com `default null` (como na captação, para chamadas incompletas receberem o erro genérico; nos tipos gerados aparecem como opcionais). Chaves desconhecidas de `utm`/`click_ids` e URLs inválidas são descartadas em vez de recusar o lead. Responsável inativo → lead sem responsável.
- Storage `landing-assets`: nome do arquivo precisa ser exatamente `{uuid}.{jpg|jpeg|png|webp}` e `page_id` precisa ter formato de uuid (a página não precisa existir ainda).
- `lead_duplicate_flags` (pedido do funil): além de `clients.phone`, compara `clients.whatsapp`; o cliente já vinculado ao próprio lead não conta; sem sessão retorna `42501`.
- `log_access_event` aceita `lead` e `leads` e grava sempre `leads` (mesmo nome usado pelo trigger de auditoria).

## Subdomínio da imobiliária

Cada imobiliária é acessada por `{slug}.seucrm.com.br`, então `organizations.slug` é um rótulo DNS:

- Formato (CHECK `organizations_slug_format`): `^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$` (3 a 60 caracteres, letras minúsculas, dígitos e hífen, sem hífen no início ou no fim) **e** sem `--` nas posições 3 e 4. Essa última parte é um desvio de segurança em relação a `apps/web/lib/tenant/urls.ts`: rótulos como `xn--...` são nomes internacionalizados (punycode) que o navegador pode exibir com letras parecidas com as de outra marca. `imob--sub` continua válido.
- Reservados (CHECK `organizations_slug_not_reserved`, função imutável `private.is_reserved_subdomain(text)`): `www`, `app`, `api`, `admin`, `auth`, `login`, `entrar`, `cadastro`, `onboarding`, `painel`, `dashboard`, `conta`, `mail`, `email`, `smtp`, `imap`, `pop`, `ftp`, `ns1`, `ns2`, `blog`, `docs`, `ajuda`, `suporte`, `status`, `static`, `cdn`, `assets`, `img`, `media`, `files`, `storage`, `dev`, `staging`, `preview`, `lp`, `feeds`, `captar`, `convite`. **Mantenha igual a `RESERVED_SUBDOMAINS` em `apps/web/lib/tenant/urls.ts`** (o harness de testes compara as duas listas); para mudar, crie migração com `create or replace function private.is_reserved_subdomain` (e confira os slugs existentes antes).
- `create_organization` normaliza (minúsculas, sem espaços nas pontas) e recusa com `22023`: formato inválido (`Endereço inválido: use de 3 a 60 letras minúsculas, números e hífens.`) ou reservado (`Este endereço é reservado. Escolha outro.`). As CHECKs valem também para gravações diretas (`service_role`, SQL): erro `23514` com o nome da constraint.
- A CHECK chama uma função do schema `private` com o papel de quem grava: `authenticated` e `service_role` têm EXECUTE nela; um papel novo que grave em `organizations` também precisa.

## Perfis (`profiles`)

- Criados pelo trigger `on_auth_user_created` (`private.handle_new_user`): `id`, `full_name` (de `raw_user_meta_data.full_name`, aparado e **truncado em 160**; vazio vira `null`) e `email`. Nome longo no cadastro não derruba mais o signup. `on_auth_user_email_changed` mantém `profiles.email` igual a `auth.users.email`.
- Usuários criados antes do trigger receberam perfil pelo backfill da migração `subdomain_slug_and_profile_backfill`: `private.backfill_profiles()` insere só quem não tem perfil (nome = `full_name` do cadastro ou, sem ele, a parte local do e-mail, até 160) e sincroniza `email` divergente; retorna `{"inserted": n, "email_synced": n}`. É idempotente e pode ser rodada de novo pelo SQL Editor (`select private.backfill_profiles();`); só o dono das tabelas executa (`anon`/`authenticated` não).

## Regras garantidas no banco (além do RLS por papel)

- **Autor do registro**: com sessão de usuário, `created_by` (e `client_documents.uploaded_by`) vira `auth.uid()` no INSERT e não pode ser alterado no UPDATE (`42501`). Vale para `activities`, `appointments`, `tasks`, `clients`, `client_interests`, `client_documents`, `condominiums`, `properties`, `property_media`, `property_owners`, `keys`, `key_movements`, `proposals`, `listing_authorizations`, `landing_pages`, `leads`.
- **Membros referenciados** precisam ser membros ativos da mesma imobiliária (`23514`, mensagem com "membro ativo"): `properties.broker_id/captured_by`, `clients.assigned_to`, `appointments.broker_id`, `tasks.assignee_id`, `proposals.broker_id`, `client_shares.user_id`, `key_movements.taken_by_user`, `landing_pages.lead_assignee_id`, `leads.assigned_to`.
- **Propostas** (`P0001`, mensagens pt-BR): nova proposta começa como `draft` ou `sent`; `draft → sent | withdrawn`; `sent → countered | accepted | rejected | withdrawn`; `countered → sent | accepted | rejected | withdrawn`; `accepted`, `rejected`, `withdrawn` são finais e não podem ser editadas. Ao entrar em estado final, `decided_at = now()` se vier nulo; em estados abertos `decided_at` fica nulo. INSERT/UPDATE exigem cliente acessível e (dono/gerente, `broker_id = auth.uid()` ou quem edita o imóvel); UPDATE só nas colunas `amount, payment_terms, conditions, valid_until, purpose, broker_id, client_id, property_id, status, decided_at`.
- **Proprietários** (`property_owners`): vincular exige editar o imóvel **e** acessar o cliente; UPDATE só de `share_percent`.
- **Chaves** (`key_movements`): retirada para cliente exige acesso ao cliente; UPDATE só de `returned_at`, `due_at`, `notes`.
- **Tarefas e visitas**: trocar `client_id` exige acesso ao novo cliente (`42501`, `Você não tem acesso ao cliente escolhido.`); o responsável continua podendo concluir tarefa/visita de cliente que não vê.
- **Equipe**: membros entram só por `create_organization` e `accept_invitation`. Convites: INSERT só de `organization_id, email, role, expires_at` (token, aceite e autor são do banco); dono lê todos, gerente só os de `broker`, `capturer`, `assistant`.
- **Organização**: SELECT por coluna para `authenticated` (todas exceto `feed_token`; ler o token só por `get_feed_settings`). `select *` em `organizations` falha com `permission denied`.
- **Landing pages e leads**: ver a seção acima.

## Buckets

| Bucket             | Acesso                                                                                                                                                                                                                                                                                 | Caminho                                                                                                      | Limites                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `property-media`   | **público** para leitura (os portais baixam as fotos pela URL do feed VRSync); listar, enviar e remover só membros com permissão de editar o imóvel                                                                                                                                    | `{organization_id}/properties/{property_id}/{arquivo}`                                                       | jpg, webp até 2 MB (foto JPEG 1600 px + miniatura `{nome}__thumb.webp`); até 20 fotos por imóvel (`limite_fotos_imovel`) |
| `client-documents` | privado; leitura conforme `private.can_access_client`, envio por quem edita o cliente, remoção por dono/gerente; o autor do upload (`owner_id`) também remove o próprio arquivo **enquanto não existir** linha em `client_documents` com esse `storage_path` (limpeza de upload órfão) | `{organization_id}/clients/{client_id}/{arquivo}`                                                            | pdf, jpg, png, webp até 10 MB (também `client_documents.size_bytes`)                                                     |
| `landing-assets`   | **público** para leitura (a página pública usa a URL pública); listar por membros; enviar, substituir e remover por `owner`, `manager` e `assistant` da imobiliária da pasta                                                                                                           | `{organization_id}/landing/{page_id}/{uuid}.{jpg\|jpeg\|png\|webp}` (nome exato; sem SVG, subpastas ou `..`) | jpg, png, webp até 2 MB                                                                                                  |

## Manutenção agendada (pg_cron)

`pg_cron` (grátis no plano Free; migrações `scheduled_maintenance` e `storage_savings`) roda 4 jobs de limpeza. Nenhum chama HTTP externo nem apaga dado de negócio ativo (`clients`, `properties`, `leads`, etc.); só `retencao-auditoria` toca em `audit_events` (ver "Retenção da auditoria").

| Job                           | Agenda                                       | Função(ões) chamadas                                                              | O que apaga                                                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `limpeza-nonces-e-tentativas` | a cada 30 min (`*/30 * * * *`)               | `private.cleanup_expired_nonces()`, `private.cleanup_stale_rate_limit_attempts()` | `private.capture_request_nonces` com mais de 24h (validade real: 12h); `private.capture_request_attempts` e `private.landing_lead_attempts` com mais de 2 dias (janela real do limite: minutos)                                       |
| `limpeza-convites-expirados`  | diário às 03:17 UTC (`17 3 * * *`)           | `private.cleanup_expired_invitations()`                                           | `public.invitations` **não aceitos** (`accepted_at is null`) cujo `expires_at` passou há mais de 30 dias. Convites aceitos nunca são apagados                                                                                         |
| `retencao-auditoria`          | semanal, domingo às 04:23 UTC (`23 4 * * 0`) | `private.cleanup_old_audit_events()`                                              | `public.audit_events` com mais de 180 dias, **exceto** acessos a dado sensível (`view`, `download`, `export`, `print` de `log_access_event`), que ficam 5 anos. Lotes de 5.000, até 100 por execução (o resto sai na semana seguinte) |
| `limpeza-historico-cron`      | semanal, domingo às 04:47 UTC (`47 4 * * 0`) | `private.cleanup_old_cron_run_details()`                                          | `cron.job_run_details` com mais de 14 dias (`end_time`, ou `start_time` se a execução não terminou)                                                                                                                                   |

As 5 funções são `security definer`, `set search_path = ''`, sem `EXECUTE` para `anon`/`authenticated` (só os jobs do `pg_cron` as chamam) e retornam quantas linhas apagaram (`integer`), para ver no histórico do job:

```sql
select jobname, schedule, active from cron.job order by jobname;

select
  j.jobname,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
order by r.start_time desc
limit 20;
```

Rodar uma função manualmente (sem esperar o agendamento), com o número de linhas apagadas:

```sql
select private.cleanup_expired_nonces();
select private.cleanup_stale_rate_limit_attempts();
select private.cleanup_expired_invitations();
select private.cleanup_old_audit_events();
select private.cleanup_old_cron_run_details();
```

### Retenção da auditoria

- Alterações registradas pelos triggers de auditoria (`insert`/`update`/`delete` em `clients`, `client_documents`, `properties`, `memberships`, `leads`): **180 dias**.
- Acessos a dado sensível registrados por `log_access_event` (`view`, `download`, `export`, `print`): **5 anos**. Esse prazo segue a guarda usual de PLD/COAF do setor imobiliário e **ainda depende de validação jurídica**; para mudar, crie migração nova com `create or replace function private.cleanup_old_audit_events()`.
- Reordenar cards do funil (update só de `leads.position`) não gera evento.

### Arquivos órfãos no Storage (só leitura)

`private.list_orphan_storage_objects(p_limit)` (1 a 1000, padrão 100) lista objetos de `property-media` com mais de 24 h sem linha em `property_media` (`name`, `size_bytes`, `created_at`, `is_thumbnail`). `{nome}__thumb.webp` pertence à foto `{nome}.{ext}` e só aparece se a principal também não tiver linha. Sem `EXECUTE` para `anon`/`authenticated`; rode pelo SQL Editor ou MCP:

```sql
select * from private.list_orphan_storage_objects(100);
```

**Não apague por SQL em `storage.objects`**: isso remove só o registro e o arquivo físico continua ocupando espaço (o Storage também bloqueia com `storage.protect_delete`). A remoção fica para uma rotina futura no servidor, via Storage API (`remove`), usando esta lista.

Pausar/retomar um job (sem apagá-lo): `select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'limpeza-nonces-e-tentativas'), active := false);` (troque `false` por `true` para retomar).

Remover um job de vez: `select cron.unschedule('limpeza-nonces-e-tentativas');` (ou `'limpeza-convites-expirados'`, `'retencao-auditoria'`, `'limpeza-historico-cron'`). Recriar: rode de novo o bloco de agendamento da migração que criou o job (`scheduled_maintenance` ou `storage_savings`; idempotente) ou o `select cron.schedule(...)` correspondente.

`pg_cron` não roda no PGlite (harness de testes): a migração detecta isso via `pg_available_extensions` e pula a criação da extensão; o schema `cron` é substituído por um stub em `stubs.sql` do harness só para exercitar `cron.schedule`/`cron.unschedule`.

## Assinatura (billing)

- `billing_server_key` (env `BILLING_SERVER_KEY`): segredo do Vault usado pelas RPCs `sync_billing_account`, `get_billing_account_ids` e `list_billing_reminders`. Leitura e rotação iguais às da `lead_server_key` (SQL Editor ou MCP `execute_sql`, com usuário administrador; nunca pela API):

```sql
-- valor para BILLING_SERVER_KEY
select decrypted_secret from vault.decrypted_secrets where name = 'billing_server_key';

-- rotação (atualize a variável do servidor logo em seguida)
select vault.update_secret(
  (select id from vault.secrets where name = 'billing_server_key'),
  encode(extensions.gen_random_bytes(32), 'hex')
);
```

- **Convenção de limites** (ex.: `limite_usuarios`, `limite_landing_pages` em `billing_accounts.limits`): `-1` = ilimitado; chave ausente = ilimitado; `0` = não incluso no plano.
- **Modo leitura**: bloqueia INSERT/UPDATE com sessão de usuário nas tabelas de negócio. Ficam liberados: DELETE, edição de perfil e dos dados da organização, desativar membro, aceite de convite, leads criados pela RPC pública e as cascatas decorrentes.
- **Pendências**: o feed dos portais ainda não pausa no modo leitura, e uploads no Storage ainda não são bloqueados.

## Indique e ganhe

Regras e números no app (`packages/core/src/billing/referrals.ts`); o banco guarda só o mínimo e aplica a atribuição com antifraude.

- **Código**: `organizations.referral_code`, 8 caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (mantenha igual a `REFERRAL_CODE_ALPHABET`/`REFERRAL_CODE_LENGTH` no core), gerado pelo default `private.new_referral_code()` (tenta até 20 vezes um código livre). Único e imutável (trigger `organizations_protect_referral`, `42501`). Link público: `/i/{código}` (route handler do app grava o cookie `ref` e leva ao cadastro).
- **Atribuição**: só em `create_organization(..., p_referral_code)`, uma única vez. Formato inválido, código inexistente ou bloqueio antifraude são ignorados em silêncio (a imobiliária é criada sem indicação). `private.referral_attribution_blocked(p_referrer, p_user)` bloqueia quando quem cria já é/foi membro da indicadora, recebeu convite dela, ou é dono de outra imobiliária com `stripe_subscription_id` ou `first_paid_at`. `referred_by_organization_id` não aceita a própria imobiliária (CHECK), não pode ser definida nem trocada depois (trigger) e vira `null` se a indicadora for excluída.
- **Antifraude contínuo** (`referral_program_hardening`): CNPJ igual também bloqueia a atribuição; `get_referral_state` reavalia a cada leitura membros em comum (ativos ou não) e CNPJ igual (`ineligible_reason` `shared_members`/`same_cnpj`), além de estorno/disputa gravados (`refund`, `dispute`, `dispute_lost`). Indicada inelegível nunca conta.
- **Colunas de cobrança**: `billing_accounts.first_paid_at` (1ª fatura de criação/renovação paga com valor > 0; nunca muda), `plan_net_monthly_cents` (valor líquido mensal do item de plano na última fatura paga de criação/renovação; fatura mais antiga não sobrescreve; trava do desconto), `referral_counted_at` (marca quando a indicada passa a contar; limpar gera o aviso de perda), `referral_confirmed_notified_at` (reserva exclusiva do aviso de confirmação), `referral_ineligible_at`/`referral_ineligible_reason` e `referral_discount_percent` (0 a 100; o percentual do cupom `indicacao_*` na assinatura; 0 enquanto a indicadora não tem plano pago). Sessões leem só `referral_discount_percent` (grant por coluna + RLS de membros).
- **Nome das indicadas**: `private.mask_referral_name` mantém a primeira palavra só quando é claramente de empresa (`Imobiliária Jardim Sul` → `Imobiliária J.`); senão devolve só iniciais (`Fernanda Souza Imóveis` → `F. S.`). O nome completo nunca sai do banco pelas RPCs do programa.
- **Stripe (verificado em modo teste)**: preços `seat_*` ficam num produto separado dos 4 produtos `plan_*`; os cupons `indicacao_10` … `indicacao_100` têm `applies_to` = exatamente os produtos de plano (o app valida e recusa cupom divergente). Com agenda (downgrade) ativa, o cupom é trocado nas fases da agenda.

RPCs do servidor (anon/authenticated, só com `billing_server_key`; `42501` sem a chave). As da tabela abaixo são da primeira migração: `record_billing_first_payment` e `set_referral_discount_percent` foram removidas em `referral_program_hardening`, substituídas por `record_billing_invoice_paid(p_server_key, p_organization_id, p_paid_at, p_invoice_created_at, p_amount_paid_cents, p_plan_net_monthly_cents)` e `apply_referral_recalculation(p_server_key, p_organization_id, p_expected_percent, p_percent, p_count, p_uncount)` (conflito devolve `{"status": "conflict"}`; transições voltam em `counted`/`uncounted`). Novas: `set_referral_confirmation_notice(p_server_key, p_referrer_organization_id, p_referred_organization_id, p_claim)`, `set_referral_ineligibility(p_server_key, p_organization_id, p_reason)` (`refund`, `dispute`, `dispute_lost`, `dispute_won`) e `list_referral_referrers(p_server_key, p_seed, p_after, p_limit)`; `list_referral_grace_completions` ganhou cursor `(p_cursor_paid_at, p_cursor_organization_id)` e `p_limit`; `get_referral_state` devolve até 1000 indicadas (as que já pagaram primeiro) com `referral_total`, `referrals_truncated`, `net_monthly_cents`, `counted_at`, `confirmed_notified_at` e `ineligible_reason`. Contratos completos nos comentários da migração.

| Função                                                                      | Retorno e erros                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `record_billing_first_payment(p_server_key, p_organization_id, p_paid_at)`  | `boolean`: `true` quando gravou `first_paid_at` agora (só grava se estiver nulo; data futura vira `now()`). `22023` data fora de 2000..agora + 1 dia; `P0002` sem conta de billing.                                                                                                                                                                                                                                                    |
| `get_referral_state(p_server_key, p_organization_id)`                       | `jsonb` `{ organization: { id, slug, name, referral_code, referred_by_organization_id, status, plan_key, billing_interval, stripe_subscription_id, first_paid_at, referral_discount_percent, owner_emails }, referrals: [{ organization_id, display_name, created_at, status, plan_key, billing_interval, first_paid_at, referral_discount_percent }] }` (até 500 indicadas, mais recentes primeiro). `P0002` imobiliária inexistente. |
| `set_referral_discount_percent(p_server_key, p_organization_id, p_percent)` | `integer` (percentual anterior). `22023` fora de 0..100; `P0002` sem conta de billing.                                                                                                                                                                                                                                                                                                                                                 |
| `list_referral_grace_completions(p_server_key, p_paid_after, p_paid_until)` | `table (referrer_organization_id, referred_organization_id, first_paid_at)`: indicadas com 1ª fatura paga em `(p_paid_after, p_paid_until]`, até 500. `22023` janela nula, invertida ou maior que 31 dias. Usada pelo cron diário.                                                                                                                                                                                                     |

## Avisos do Security Advisor que são intencionais

- `0028 anon_security_definer_function_executable`: `get_portal_feed`, `submit_capture_request`, `get_public_organization`, `get_invitation_preview`, `get_public_landing_page`, `submit_landing_lead`, `sync_billing_account`, `get_billing_account_ids`, `list_billing_reminders`, `get_notification_recipients`, `record_billing_first_payment`, `get_referral_state`, `set_referral_discount_percent` e `list_referral_grace_completions` precisam ser públicas (feed dos portais, formulário de captação, perfil público da imobiliária, prévia do convite, landing page pública, envio de lead, sincronização e lembretes de assinatura, destinatários de notificação e Indique e ganhe). `submit_capture_request`, `submit_landing_lead`, `sync_billing_account`, `get_billing_account_ids`, `list_billing_reminders`, `get_notification_recipients` e as 4 RPCs do Indique e ganhe só aceitam chamadas com a chave do servidor correspondente (segredos distintos no Vault: `capture_server_key`, `lead_server_key`, `billing_server_key`, `notification_server_key`). [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- `0029 authenticated_security_definer_function_executable`: `create_organization`, `accept_invitation`, `log_access_event`, `rotate_feed_token`, `get_feed_settings`, `get_portal_feed`, `submit_capture_request`, `get_public_organization`, `get_invitation_preview`, `get_public_landing_page`, `submit_landing_lead`, `lead_duplicate_flags`, `sync_billing_account`, `get_billing_account_ids`, `list_billing_reminders`, `get_billing_overview` e `get_notification_recipients` validam permissão internamente e fazem o que o RLS não permite diretamente (`get_billing_overview` exige membro ativo da imobiliária; `sync_billing_account`, `get_billing_account_ids`, `list_billing_reminders` e `get_notification_recipients` exigem a chave do servidor correspondente). [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- `0008 rls_enabled_no_policy` (INFO) em `private.organization_counters`, `private.capture_request_attempts`, `private.capture_request_nonces` e `private.landing_lead_attempts`: proposital, só funções security definer acessam. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- `auth_leaked_password_protection`: ligar no painel (Authentication > Providers > Email > Leaked password protection). [Remediação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Performance `0005 unused_index` (INFO): banco sem uso real ainda; os índices cobrem FKs e as consultas previstas (inclusive os limites da captação e dos leads e as buscas do funil). Reavaliar com tráfego. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## Novas migrações

```bash
supabase link --project-ref qwaywbtyfkovulvirujp
supabase migration new <nome>      # escreva o SQL
supabase db push                   # aplica as pendentes
supabase gen types typescript --project-id qwaywbtyfkovulvirujp --schema public > packages/database/src/types.ts
```

Cuidados:

1. Os privilégios padrão do Supabase dão a `anon`/`authenticated` acesso a toda tabela e EXECUTE a toda função nova em `public`: habilite RLS em tabelas novas, faça `revoke truncate, trigger, references on <tabela> from anon, authenticated` (e `revoke all ... from anon`) e `revoke execute ... from public, anon` em funções `security definer` que não sejam públicas.
2. Tabelas com grant por coluna (`organizations` SELECT/UPDATE, `invitations` INSERT/UPDATE, `memberships` UPDATE, `profiles` UPDATE, `capture_requests` UPDATE, `proposals` UPDATE, `key_movements` UPDATE, `property_owners` UPDATE, `landing_pages` INSERT/UPDATE, `leads` INSERT/UPDATE): coluna nova só fica acessível ao app se entrar no `grant` correspondente.
3. Tabela nova com `created_by` preenchido pelo app: crie o trigger `before insert or update of created_by ... execute function private.enforce_author_column('created_by')`.
4. Não adicione `private` nem `vault` em Settings > API > Exposed schemas.
5. Rode o Security Advisor depois de cada migração e regenere `packages/database/src/types.ts` (é gerado; não edite à mão).
