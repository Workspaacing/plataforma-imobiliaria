# Banco de dados (Supabase)

Schema da Entrega 1: multi-imobiliária por `organization_id`, RLS em todas as tabelas de `public` e funções de autorização no schema `private` (não exposto na API).

- Projeto: `qwaywbtyfkovulvirujp` (Postgres 17, sa-east-1)
- Extensões usadas (schema `extensions`): `pgcrypto` (tokens, SHA-256) e `unaccent` (match sem acentos); Supabase Vault (`vault`) guarda a chave do servidor da captação

## Migrações aplicadas

Os nomes dos arquivos usam a mesma versão registrada no histórico do projeto remoto (`supabase_migrations.schema_migrations`), para a CLI não tentar reaplicá-las.

| Versão | Arquivo | Conteúdo |
| --- | --- | --- |
| 20260915054812 | `foundation` | schema `private`, funções utilitárias e todos os enums |
| 20260915054907 | `base` | `organizations`, `profiles` (trigger em `auth.users`), `memberships`, `invitations`, `audit_events`, `private.is_member/has_role`, RPCs `create_organization` e `accept_invitation` |
| 20260915054939 | `clients` | `clients`, `client_shares`, `client_interests`, `client_documents` |
| 20260915055058 | `properties` | `condominiums`, `properties` (código `IMV-000001` por imobiliária, imutável), `property_media`, `property_owners`, `keys`, `key_movements`, `proposals`, `listing_authorizations`, `capture_requests` |
| 20260915055123 | `agenda` | `activities`, `appointments`, `tasks` |
| 20260915055244 | `rls_policies` | `private.can_access_client`, `private.can_edit_property` e as políticas RLS |
| 20260915055326 | `views_and_rpcs` | view `client_property_matches`, RPCs `submit_capture_request` e `log_access_event` |
| 20260915055343 | `audit_triggers` | auditoria de insert/update/delete em `clients`, `client_documents`, `properties`, `memberships` |
| 20260915055406 | `storage` | buckets e políticas do Storage |
| 20260915055450 | `hardening` | convites visíveis só a dono/gerente; validação de membros ativos; `unaccent` no match; `organizations.feed_token`, RPCs `rotate_feed_token` e `get_portal_feed` |
| 20260915055727 | `advisor_fixes` | RLS habilitado em `private.organization_counters` |
| 20260915060618 | `public_organization_profile` | RPC `get_public_organization` (perfil público da imobiliária para o formulário `/captar/[slug]`) |
| 20260915064425 | `invitation_preview` | RPC `get_invitation_preview` (prévia do convite para a tela pública `/convite/[token]`) |
| 20260915072442 | `security_hardening_2` | auditoria de segurança (C1 + revisão do app C2): vínculo de proprietário exige acesso ao cliente; sem INSERT direto em `memberships`; convite exige e-mail confirmado e não reativa dono desativado; gerente só lê convites da equipe operacional; autor (`created_by`/`uploaded_by`) definido pelo banco; `key_movements` e `proposals` com checagens e grants por coluna; fluxo de status de propostas; `feed_token` fora do SELECT + RPC `get_feed_settings`; feed respeita `address_display`; `submit_capture_request` com chave do servidor (Vault), nonce e limite por visitante; sem TRUNCATE/TRIGGER/REFERENCES para `anon`/`authenticated` |
| 20260915072935 | `security_hardening_2_followup` | trocar o cliente de tarefa/visita exige acesso a ele; autor apaga o próprio upload órfão em `client-documents` |

## RPCs públicas

| Função | Quem executa | Retorno |
| --- | --- | --- |
| `create_organization(p_name, p_slug, p_legal_name?, p_cnpj?, p_creci?, p_city?, p_state?)` | authenticated | `uuid` da imobiliária; cria a membership `owner`. Não existe INSERT direto em `organizations` nem em `memberships`. |
| `accept_invitation(p_token)` | authenticated | `uuid` da imobiliária; valida token, validade, e-mail do usuário e **e-mail confirmado**. Erros: `P0002` convite inválido/usado, `22023` expirado, `42501` com mensagem `Este convite foi enviado para outro e-mail.` ou `Confirme seu e-mail antes de aceitar o convite.` (diferencie pela mensagem). Dono ativo continua dono; dono desativado volta com o papel do convite. |
| `submit_capture_request(org_slug, payload, p_server_key, p_nonce, p_client_key?)` | anon, authenticated (só com a chave do servidor) | `uuid` da captação. Contrato completo abaixo. |
| `log_access_event(p_entity, p_entity_id, p_action?)` | authenticated | registra leitura/download/exportação de dado sensível (LGPD). |
| `rotate_feed_token(p_organization_id)` | authenticated (só dono) | novo `feed_token`. |
| `get_feed_settings(p_organization_id)` | authenticated (dono ou gerente ativos) | `jsonb` `{ "slug": text, "feed_token": text }`. Demais papéis e não membros: erro `42501` (`Só o dono ou o gerente da imobiliária podem ver o endereço do feed.`). É a única forma de o app ler o `feed_token`. |
| `get_portal_feed(p_org_slug, p_token)` | anon, authenticated | `jsonb` com `organization` e `properties` ativos e publicados (com `media` ordenada por `position`); `null` se slug ou token não conferem. Endereço conforme `address_display`: `full` traz tudo; `street` omite as chaves `street_number`, `complement`, `latitude`, `longitude`; `neighborhood` omite também `street`. |
| `get_public_organization(p_slug)` | anon, authenticated | `jsonb` com `name`, `city`, `state`, `phone`, `email`, `creci` e `brand` da imobiliária (sem `id`, `cnpj`, `feed_token` ou `created_by`); `null` se o slug não existir. Usada pelo formulário público de captação `/captar/[slug]`. |
| `get_invitation_preview(p_token)` | anon, authenticated | `jsonb` com `organization_name`, `role`, `expires_at`, `expired`, `accepted` e `email_hint` (e-mail convidado mascarado, ex.: `ma***@gmail.com`); `null` se o token não existir. Nunca expõe `id`, `token` ou `organization_id`. Usada pela tela pública `/convite/[token]` antes do aceite. |

A URL do feed para os portais inclui o `feed_token` da imobiliária; o app chama `get_portal_feed` com a chave anon, sem `service_role`.

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
  payload,                                   // mesmo formato de antes
  p_server_key: process.env.CAPTURE_SERVER_KEY,
  p_nonce: crypto.randomUUID(),              // novo a cada envio
  p_client_key: visitorHash,                 // opcional: HMAC-SHA256(IP) em hex
})
```

- `payload`: `owner_name` (obrigatório, 2 a 120), `owner_email` e/ou `owner_phone` (ao menos um), `purpose` (`sale`, `rent`, `sale_rent`), `type`, `postal_code`, `neighborhood`, `city`, `state`, `expected_price` (`"750000.00"`), `message` (até 2.000), `consent: true` (LGPD). Até 16 KB. O e-mail é validado de forma estrita (sem espaços, quebras de linha, `?`, `&` ou `..`; domínio com TLD).
- `p_server_key`: valor do segredo `capture_server_key` do Vault. Fica só no servidor (`CAPTURE_SERVER_KEY` no `.env.local`/variáveis da Vercel), nunca no browser.
- `p_nonce`: 16 a 512 caracteres visíveis (sem espaço), novo por envio. Só é consumido quando o envio é aceito (erro de validação não o gasta); não pode se repetir em 12 h. O banco guarda só o SHA-256.
- `p_client_key`: hash do visitante calculado pelo app (nunca o IP em claro), 32 a 128 caracteres `[A-Za-z0-9_=+/-]` (hex ou base64url). O banco guarda só esse valor, por até 1 dia.
- Limites: 30 envios por minuto por imobiliária (todos os envios) e 5 envios a cada 10 minutos por `p_client_key` na mesma imobiliária. Envios da mesma imobiliária são serializados (advisory lock), então os limites valem com requisições simultâneas.

Erros (`code` do PostgREST):

| Código | Quando | Mensagem |
| --- | --- | --- |
| `42501` | chave do servidor ausente/errada, nonce ausente/inválido/repetido (sempre a mesma, sem indicar o motivo; é verificado antes de qualquer outra coisa) | `Não foi possível enviar o formulário.` |
| `22023` | validação do payload ou `p_client_key` com formato inválido | mensagem pt-BR pronta para exibir |
| `P0002` | slug não existe | `Imobiliária não encontrada.` |
| `54000` | limite atingido; `details` = `organization` ou `client_key` | `Muitas solicitações em pouco tempo. Tente novamente em instantes.` / `Você enviou muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo.` |

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

## Regras garantidas no banco (além do RLS por papel)

- **Autor do registro**: com sessão de usuário, `created_by` (e `client_documents.uploaded_by`) vira `auth.uid()` no INSERT e não pode ser alterado no UPDATE (`42501`). Vale para `activities`, `appointments`, `tasks`, `clients`, `client_interests`, `client_documents`, `condominiums`, `properties`, `property_media`, `property_owners`, `keys`, `key_movements`, `proposals`, `listing_authorizations`.
- **Membros referenciados** precisam ser membros ativos da mesma imobiliária (`23514`, mensagem com "membro ativo"): `properties.broker_id/captured_by`, `clients.assigned_to`, `appointments.broker_id`, `tasks.assignee_id`, `proposals.broker_id`, `client_shares.user_id`, `key_movements.taken_by_user`.
- **Propostas** (`P0001`, mensagens pt-BR): nova proposta começa como `draft` ou `sent`; `draft → sent | withdrawn`; `sent → countered | accepted | rejected | withdrawn`; `countered → sent | accepted | rejected | withdrawn`; `accepted`, `rejected`, `withdrawn` são finais e não podem ser editadas. Ao entrar em estado final, `decided_at = now()` se vier nulo; em estados abertos `decided_at` fica nulo. INSERT/UPDATE exigem cliente acessível e (dono/gerente, `broker_id = auth.uid()` ou quem edita o imóvel); UPDATE só nas colunas `amount, payment_terms, conditions, valid_until, purpose, broker_id, client_id, property_id, status, decided_at`.
- **Proprietários** (`property_owners`): vincular exige editar o imóvel **e** acessar o cliente; UPDATE só de `share_percent`.
- **Chaves** (`key_movements`): retirada para cliente exige acesso ao cliente; UPDATE só de `returned_at`, `due_at`, `notes`.
- **Tarefas e visitas**: trocar `client_id` exige acesso ao novo cliente (`42501`, `Você não tem acesso ao cliente escolhido.`); o responsável continua podendo concluir tarefa/visita de cliente que não vê.
- **Equipe**: membros entram só por `create_organization` e `accept_invitation`. Convites: INSERT só de `organization_id, email, role, expires_at` (token, aceite e autor são do banco); dono lê todos, gerente só os de `broker`, `capturer`, `assistant`.
- **Organização**: SELECT por coluna para `authenticated` (todas exceto `feed_token`; ler o token só por `get_feed_settings`). `select *` em `organizations` falha com `permission denied`.

## Buckets

| Bucket | Acesso | Caminho | Limites |
| --- | --- | --- | --- |
| `property-media` | **público** para leitura (os portais baixam as fotos pela URL do feed VRSync); listar, enviar e remover só membros com permissão de editar o imóvel | `{organization_id}/properties/{property_id}/{arquivo}` | jpg, png, webp até 7 MB |
| `client-documents` | privado; leitura conforme `private.can_access_client`, envio por quem edita o cliente, remoção por dono/gerente; o autor do upload (`owner_id`) também remove o próprio arquivo **enquanto não existir** linha em `client_documents` com esse `storage_path` (limpeza de upload órfão) | `{organization_id}/clients/{client_id}/{arquivo}` | pdf, jpg, png, webp até 20 MB |

## Avisos do Security Advisor que são intencionais

- `0028 anon_security_definer_function_executable`: `get_portal_feed`, `submit_capture_request`, `get_public_organization` e `get_invitation_preview` precisam ser públicas (feed dos portais, formulário de captação, perfil público da imobiliária e prévia do convite). `submit_capture_request` só aceita envios com a chave do servidor. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- `0029 authenticated_security_definer_function_executable`: `create_organization`, `accept_invitation`, `log_access_event`, `rotate_feed_token`, `get_feed_settings`, `get_portal_feed`, `submit_capture_request`, `get_public_organization`, `get_invitation_preview` validam permissão internamente e fazem o que o RLS não permite diretamente. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- `0008 rls_enabled_no_policy` (INFO) em `private.organization_counters`, `private.capture_request_attempts` e `private.capture_request_nonces`: proposital, só funções security definer acessam. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- `auth_leaked_password_protection`: ligar no painel (Authentication > Providers > Email > Leaked password protection). [Remediação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Performance `0005 unused_index` (INFO): banco sem uso real ainda; os índices cobrem FKs e as consultas previstas (inclusive os limites da captação). Reavaliar com tráfego. [Remediação](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## Novas migrações

```bash
supabase link --project-ref qwaywbtyfkovulvirujp
supabase migration new <nome>      # escreva o SQL
supabase db push                   # aplica as pendentes
supabase gen types typescript --project-id qwaywbtyfkovulvirujp --schema public > packages/database/src/types.ts
```

Cuidados:

1. Os privilégios padrão do Supabase dão a `anon`/`authenticated` acesso a toda tabela e EXECUTE a toda função nova em `public`: habilite RLS em tabelas novas, faça `revoke truncate, trigger, references on <tabela> from anon, authenticated` (e `revoke all ... from anon`) e `revoke execute ... from public, anon` em funções `security definer` que não sejam públicas.
2. Tabelas com grant por coluna (`organizations` SELECT/UPDATE, `invitations` INSERT/UPDATE, `memberships` UPDATE, `profiles` UPDATE, `capture_requests` UPDATE, `proposals` UPDATE, `key_movements` UPDATE, `property_owners` UPDATE): coluna nova só fica acessível ao app se entrar no `grant` correspondente.
3. Tabela nova com `created_by` preenchido pelo app: crie o trigger `before insert or update of created_by ... execute function private.enforce_author_column('created_by')`.
4. Não adicione `private` nem `vault` em Settings > API > Exposed schemas.
5. Rode o Security Advisor depois de cada migração e regenere `packages/database/src/types.ts` (é gerado; não edite à mão).
