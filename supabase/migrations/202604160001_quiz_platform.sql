create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.quiz_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_title text not null,
  subtitle text not null,
  description text not null,
  hero_copy text not null,
  share_title text not null,
  share_description text not null,
  icon text not null,
  theme_color text not null,
  theme_color_soft text not null,
  theme_ink text not null,
  theme_glow text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'inactive')),
  locale text not null default 'zh-TW',
  question_pool_size integer not null default 32 check (question_pool_size > 0),
  questions_per_session integer not null default 8 check (questions_per_session > 0),
  axis_config jsonb not null default '{}'::jsonb,
  tag_labels jsonb not null default '{}'::jsonb,
  result_theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.quiz_topics(id) on delete cascade,
  question_code text not null,
  prompt text not null,
  context_hint text not null default '',
  sort_order integer not null,
  status text not null default 'active' check (status in ('draft', 'active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (topic_id, question_code)
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  trait_weights jsonb not null default '{}'::jsonb,
  option_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (question_id, option_key)
);

create table if not exists public.result_profiles (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.quiz_topics(id) on delete cascade,
  profile_key text not null,
  title text not null,
  summary text not null,
  strengths text[] not null default '{}',
  blind_spots text[] not null default '{}',
  growth_suggestions text[] not null default '{}',
  base_prompt text not null default '',
  matching_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (topic_id, profile_key)
);

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.quiz_topics(id) on delete restrict,
  session_token text not null,
  attempt_number integer not null check (attempt_number > 0),
  source_page text not null default 'unknown',
  referrer text not null default '',
  utm jsonb not null default '{}'::jsonb,
  device_meta jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (topic_id, session_token, attempt_number)
);

create table if not exists public.session_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  display_order integer not null check (display_order > 0),
  seed_group text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (quiz_session_id, display_order),
  unique (quiz_session_id, question_id)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  quiz_session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_option_id uuid not null references public.question_options(id) on delete restrict,
  answered_at timestamptz not null default timezone('utc', now()),
  response_time_ms integer not null default 0,
  trait_delta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (quiz_session_id, question_id)
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  quiz_session_id uuid not null unique references public.quiz_sessions(id) on delete cascade,
  topic_id uuid not null references public.quiz_topics(id) on delete restrict,
  profile_key text not null,
  title text not null,
  narrative text not null,
  strengths text[] not null default '{}',
  blind_spots text[] not null default '{}',
  growth_suggestions text[] not null default '{}',
  trait_scores jsonb not null default '{}'::jsonb,
  axis_scores jsonb not null default '[]'::jsonb,
  ai_mirror_insight text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text,
  session_token text not null,
  quiz_session_id uuid references public.quiz_sessions(id) on delete set null,
  topic_id uuid references public.quiz_topics(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists analytics_events_client_event_id_unique
  on public.analytics_events (client_event_id)
  where client_event_id is not null;

create index if not exists quiz_sessions_session_token_idx on public.quiz_sessions (session_token);
create index if not exists questions_topic_id_idx on public.questions (topic_id);
create index if not exists results_quiz_session_id_idx on public.results (quiz_session_id);
create index if not exists responses_quiz_session_id_idx on public.responses (quiz_session_id);
create index if not exists analytics_events_occurred_at_idx on public.analytics_events (occurred_at desc);

drop trigger if exists quiz_topics_set_updated_at on public.quiz_topics;
create trigger quiz_topics_set_updated_at
before update on public.quiz_topics
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists question_options_set_updated_at on public.question_options;
create trigger question_options_set_updated_at
before update on public.question_options
for each row execute function public.set_updated_at();

drop trigger if exists result_profiles_set_updated_at on public.result_profiles;
create trigger result_profiles_set_updated_at
before update on public.result_profiles
for each row execute function public.set_updated_at();

drop trigger if exists quiz_sessions_set_updated_at on public.quiz_sessions;
create trigger quiz_sessions_set_updated_at
before update on public.quiz_sessions
for each row execute function public.set_updated_at();

drop trigger if exists responses_set_updated_at on public.responses;
create trigger responses_set_updated_at
before update on public.responses
for each row execute function public.set_updated_at();

alter table public.quiz_topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.result_profiles enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.session_questions enable row level security;
alter table public.responses enable row level security;
alter table public.results enable row level security;
alter table public.analytics_events enable row level security;
