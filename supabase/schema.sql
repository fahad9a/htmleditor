-- ReportCanvas — Supabase schema (already applied to the linked project as
-- migration "visual_editor_core_schema"). Kept here for reference / re-setup.

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PROJECTS ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Untitled project',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- ============ PROJECT MEMBERS ============
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

-- Security-definer helper avoids recursive RLS lookups.
create or replace function public.get_project_role(p_project uuid, p_user uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.project_members
  where project_id = p_project and user_id = p_user limit 1;
$$;

create or replace function public.handle_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- ============ DOCUMENTS ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Untitled document',
  html_content text not null default '',
  transitions jsonb not null default '{"type":"fade","duration":0.5,"delay":0}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.documents enable row level security;

create or replace function public.get_doc_role(p_doc uuid, p_user uuid)
returns text language sql security definer stable set search_path = public as $$
  select public.get_project_role(d.project_id, p_user)
  from public.documents d where d.id = p_doc;
$$;

-- ============ DOCUMENT VERSIONS ============
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  html_content text not null,
  label text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.document_versions enable row level security;

-- ============ ACTIVITY LOG ============
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.activity_log enable row level security;

-- ============ RLS POLICIES ============
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Note: owner_id check is required (not just membership) because
-- INSERT ... RETURNING evaluates this policy before the AFTER trigger
-- inserts the owner's project_members row.
create policy "projects select member" on public.projects
  for select to authenticated
  using (owner_id = auth.uid() or public.get_project_role(id, auth.uid()) is not null);
create policy "projects insert own" on public.projects
  for insert to authenticated with check (owner_id = auth.uid());
create policy "projects update owner or editor" on public.projects
  for update to authenticated
  using (public.get_project_role(id, auth.uid()) in ('owner','editor'));
create policy "projects delete owner" on public.projects
  for delete to authenticated
  using (public.get_project_role(id, auth.uid()) = 'owner');

create policy "members select member" on public.project_members
  for select to authenticated
  using (public.get_project_role(project_id, auth.uid()) is not null);
create policy "members insert owner" on public.project_members
  for insert to authenticated
  with check (public.get_project_role(project_id, auth.uid()) = 'owner');
create policy "members update owner" on public.project_members
  for update to authenticated
  using (public.get_project_role(project_id, auth.uid()) = 'owner');
create policy "members delete owner or self" on public.project_members
  for delete to authenticated
  using (public.get_project_role(project_id, auth.uid()) = 'owner' or user_id = auth.uid());

create policy "documents select member" on public.documents
  for select to authenticated
  using (public.get_project_role(project_id, auth.uid()) is not null);
create policy "documents insert editor" on public.documents
  for insert to authenticated
  with check (public.get_project_role(project_id, auth.uid()) in ('owner','editor'));
create policy "documents update editor" on public.documents
  for update to authenticated
  using (public.get_project_role(project_id, auth.uid()) in ('owner','editor'));
create policy "documents delete owner" on public.documents
  for delete to authenticated
  using (public.get_project_role(project_id, auth.uid()) = 'owner');

create policy "versions select member" on public.document_versions
  for select to authenticated
  using (public.get_doc_role(document_id, auth.uid()) is not null);
create policy "versions insert editor" on public.document_versions
  for insert to authenticated
  with check (public.get_doc_role(document_id, auth.uid()) in ('owner','editor'));

create policy "activity select member" on public.activity_log
  for select to authenticated
  using (public.get_project_role(project_id, auth.uid()) is not null);
create policy "activity insert member" on public.activity_log
  for insert to authenticated
  with check (public.get_project_role(project_id, auth.uid()) is not null and user_id = auth.uid());

-- ============ COMMENTS ============
-- (applied as migration "comments_and_image_storage")
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  element_id text,                                   -- data-vhe-id anchor; null = document-level
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_document_idx on public.comments (document_id, created_at);
alter table public.comments enable row level security;

create policy "comments select member" on public.comments
  for select to authenticated
  using (public.get_doc_role(document_id, auth.uid()) is not null);
create policy "comments insert member" on public.comments
  for insert to authenticated
  with check (public.get_doc_role(document_id, auth.uid()) is not null and author_id = auth.uid());
create policy "comments update author" on public.comments
  for update to authenticated using (author_id = auth.uid());
create policy "comments update editor" on public.comments
  for update to authenticated
  using (public.get_doc_role(document_id, auth.uid()) in ('owner','editor'));
create policy "comments delete author or owner" on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.get_doc_role(document_id, auth.uid()) = 'owner');

-- ============ IMAGE STORAGE ============
-- Public bucket for pictures uploaded from the editor (patches store the URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-images', 'report-images', true, 10485760,
        array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','image/avif'])
on conflict (id) do nothing;

create policy "report images insert authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'report-images');
create policy "report images select all" on storage.objects
  for select using (bucket_id = 'report-images');
create policy "report images delete own" on storage.objects
  for delete to authenticated using (bucket_id = 'report-images' and owner = auth.uid());
