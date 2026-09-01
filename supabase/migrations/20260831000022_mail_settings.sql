-- ============================================================================
-- Mail settings — switchable without a deploy
--
-- `MAIL_PROVIDER` was environment-only, which meant turning sending off needed
-- someone with deploy access at exactly the moment you least want a deploy: a
-- bad campaign going out, a provider incident, a domain just flagged.
-- `pricing_settings` already made this argument for the scraper — these are
-- knobs an editor turns while watching something fail, and an editor cannot
-- deploy.
--
-- WHY `provider` IS NULLABLE
--
-- Null means "follow the environment", which is a real third state and not the
-- same as 'disabled'. Every existing host is in that state, so this table
-- changes nothing until a person touches it. Collapsing null into 'disabled'
-- would have this migration silently switch mail off wherever it was on.
--
-- WHY THERE ARE NO RLS POLICIES
--
-- RLS is enabled and the policy list is deliberately empty. This row holds an
-- encrypted provider key, and PostgREST — the path the public anon key travels
-- — must have no read route to it under any role, admin included. FastAPI holds
-- its own connection and is unaffected. An admin edits this through the API,
-- which never returns the key.
-- ============================================================================

create table if not exists public.mail_settings (
  id                 boolean     primary key default true,

  -- NULL = follow MAIL_PROVIDER. See above.
  provider           text,
  from_email         text,
  from_name          text,
  reply_to           text,

  -- Fernet token, key derived from SUPABASE_JWT_SECRET. Never returned to any
  -- client; the admin API answers only whether one is set, plus the last four
  -- characters — enough to tell two keys apart, not enough to use one.
  api_key_ciphertext text,
  api_key_last4      text,

  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null,

  constraint mail_settings_singleton check (id),
  constraint mail_settings_provider_valid
    check (provider is null or provider in ('brevo', 'console', 'disabled'))
);

insert into public.mail_settings (id) values (true) on conflict (id) do nothing;

alter table public.mail_settings enable row level security;

comment on table public.mail_settings is
  'Operational mail switches an editor can turn without a deploy. RLS is enabled '
  'with NO policies on purpose: this row holds an encrypted provider key, and '
  'PostgREST must have no read path to it at all.';
