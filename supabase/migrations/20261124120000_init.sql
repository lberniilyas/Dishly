-- =============================================================================
-- Dishly — initial schema (phase 1: everything the diner menu, the dashboard
-- and analytics need; ordering/payments will be added in later migrations).
--
-- Conventions
--  * Text the owner can translate is jsonb keyed by language: {"fr": "…", "en": "…"}
--  * Prices are integer cents (what payment providers expect later)
--  * Row Level Security (RLS) is ON for every table:
--      - anyone can READ a published menu
--      - members of a restaurant can WRITE only that restaurant's data
--      - analytics events are written by our server only (secret key)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  name            text not null check (char_length(name) between 1 and 80),
  tagline         jsonb not null default '{}'::jsonb,
  logo_path       text,
  cover_path      text,
  brand_color     text not null default '#B4532A' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  default_locale  text not null default 'fr',
  enabled_locales text[] not null default array['fr'],
  currency        char(3) not null default 'EUR',
  is_published    boolean not null default false,
  -- Who created it. Needed because "insert … returning" checks read access
  -- before the trigger below has added the creator as a member.
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint restaurants_default_locale_enabled check (default_locale = any (enabled_locales))
);

create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

-- Who can manage a restaurant. A table (not a column on restaurants) so that
-- staff accounts (waiters, managers) can be added when ordering arrives.
create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner', 'staff')),
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id);

-- ---------------------------------------------------------------------------
-- Menu: categories and dishes
-- ---------------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          jsonb not null,
  position      integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index categories_restaurant_idx on public.categories (restaurant_id, position);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.dishes (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  category_id     uuid references public.categories (id) on delete set null,
  name            jsonb not null,
  description     jsonb not null default '{}'::jsonb,
  price_cents     integer check (price_cents >= 0),       -- null = price not shown
  -- Pre-resized photo variants: {"sm": path, "lg": path, "blur": data-url, "width": n, "height": n}
  photo           jsonb,
  tags            text[] not null default '{}',            -- e.g. {maison,vegetarien}
  position        integer not null default 0,
  is_available    boolean not null default true,
  active_model_id uuid,                                    -- FK added below (circular)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index dishes_restaurant_idx on public.dishes (restaurant_id, category_id, position);
create trigger dishes_updated_at before update on public.dishes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3D models. One row per processed version: re-uploading or resizing creates
-- a new row and dishes.active_model_id points to the published one (rollback
-- = point back to an older row).
-- ---------------------------------------------------------------------------
create table public.dish_models (
  id             uuid primary key default gen_random_uuid(),
  dish_id        uuid not null references public.dishes (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  source         text not null default 'upload' check (source in ('upload', 'video', 'seed')),
  status         text not null default 'uploaded'
                 check (status in ('uploaded', 'processing', 'ready', 'failed')),
  raw_path       text,                 -- original file, private bucket "model-uploads"
  glb_path       text,                 -- optimized .glb, public bucket "media"
  usdz_path      text,                 -- iPhone AR Quick Look file
  usdz_origin    text check (usdz_origin in ('generated', 'owner')),
  poster_path    text,
  target_size_cm numeric(5, 1) check (target_size_cm between 1 and 200),
  size_cm        jsonb,                -- final bounding box {x, y, z} in cm
  original_bytes bigint,
  glb_bytes      integer,
  usdz_bytes     integer,
  triangle_count integer,
  report         jsonb not null default '{}'::jsonb,
  warnings       text[] not null default '{}',
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index dish_models_dish_idx on public.dish_models (dish_id, created_at desc);
create trigger dish_models_updated_at before update on public.dish_models
  for each row execute function public.set_updated_at();

alter table public.dishes
  add constraint dishes_active_model_id_fkey
  foreign key (active_model_id) references public.dish_models (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Analytics events (the restaurants' main selling point: keep them reliable).
-- `dedupe_key` is an idempotency key sent by the browser, so retries never
-- count twice.
-- ---------------------------------------------------------------------------
create table public.events (
  id            bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dish_id       uuid references public.dishes (id) on delete set null,
  type          text not null check (type in ('menu_view', 'dish_view', 'model_loaded', 'ar_launch')),
  session_id    uuid not null,
  table_label   text check (char_length(table_label) <= 20),
  locale        text check (char_length(locale) <= 10),
  platform      text check (platform in ('ios', 'android', 'desktop', 'other')),
  ar_mode       text check (ar_mode in ('quick-look', 'scene-viewer', 'webxr')),
  dedupe_key    text not null unique check (char_length(dedupe_key) <= 64),
  created_at    timestamptz not null default now()
);
create index events_restaurant_time_idx on public.events (restaurant_id, created_at desc);
create index events_dish_type_time_idx on public.events (dish_id, type, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER lets policies check membership /
-- publication without recursively applying RLS to those lookups.
-- ---------------------------------------------------------------------------
create or replace function public.is_restaurant_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_restaurant_owner(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.is_restaurant_published(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select r.is_published from public.restaurants r where r.id = rid), false);
$$;

-- Whoever creates a restaurant becomes its owner.
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger restaurants_add_owner after insert on public.restaurants
  for each row execute function public.add_creator_as_owner();

-- ---------------------------------------------------------------------------
-- Row Level Security policies
-- ---------------------------------------------------------------------------
alter table public.restaurants        enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.categories         enable row level security;
alter table public.dishes             enable row level security;
alter table public.dish_models        enable row level security;
alter table public.events             enable row level security;

-- restaurants
create policy "Published restaurants are public" on public.restaurants
  for select to anon, authenticated
  using (is_published or created_by = (select auth.uid()) or public.is_restaurant_member(id));
create policy "Signed-in users can create a restaurant" on public.restaurants
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Members can update their restaurant" on public.restaurants
  for update to authenticated
  using (public.is_restaurant_member(id)) with check (public.is_restaurant_member(id));
create policy "Owners can delete their restaurant" on public.restaurants
  for delete to authenticated using (public.is_restaurant_owner(id));

-- restaurant_members: users see their own memberships (invitations come later)
create policy "Users see their memberships" on public.restaurant_members
  for select to authenticated using (user_id = (select auth.uid()));

-- categories
create policy "Categories of published menus are public" on public.categories
  for select to anon, authenticated
  using (public.is_restaurant_published(restaurant_id) or public.is_restaurant_member(restaurant_id));
create policy "Members manage categories" on public.categories
  for all to authenticated
  using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));

-- dishes
create policy "Dishes of published menus are public" on public.dishes
  for select to anon, authenticated
  using (public.is_restaurant_published(restaurant_id) or public.is_restaurant_member(restaurant_id));
create policy "Members manage dishes" on public.dishes
  for all to authenticated
  using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));

-- dish_models: diners only see finished models
create policy "Ready models of published menus are public" on public.dish_models
  for select to anon, authenticated
  using (
    (status = 'ready' and public.is_restaurant_published(restaurant_id))
    or public.is_restaurant_member(restaurant_id)
  );
create policy "Members manage models" on public.dish_models
  for all to authenticated
  using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));

-- events: no insert policy on purpose (server-side writes only); members read stats
create policy "Members read their analytics" on public.events
  for select to authenticated using (public.is_restaurant_member(restaurant_id));

-- Explicit privileges (don't rely on project defaults)
grant select on public.restaurants, public.categories, public.dishes, public.dish_models to anon, authenticated;
grant insert, update, delete on public.restaurants, public.categories, public.dishes, public.dish_models to authenticated;
grant select on public.restaurant_members, public.events to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Storage
--   media          public  photos, logos, optimized models (CDN-cached)
--   model-uploads  private raw scans as uploaded by the owner
-- Paths always start with the restaurant id: "<restaurant_id>/…"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'model/vnd.usdz+zip']),
  ('model-uploads', 'model-uploads', false, 52428800, null)
on conflict (id) do nothing;

-- First folder of a storage path as a restaurant id (null if it isn't a uuid).
create or replace function public.storage_restaurant_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

create policy "Members manage their restaurant files" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('media', 'model-uploads')
    and public.is_restaurant_member(public.storage_restaurant_id(name))
  )
  with check (
    bucket_id in ('media', 'model-uploads')
    and public.is_restaurant_member(public.storage_restaurant_id(name))
  );
