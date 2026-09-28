-- =============================================================================
-- COLLABORATIVE DOCUMENT PLATFORM — POSTGRESQL SCHEMA (Supabase)
-- =============================================================================
-- Run via: supabase db push
-- Assumes Supabase Auth is enabled (auth.users table already exists).
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- USERS (public profile, mirrors auth.users)
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a public.users row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- WORKSPACES
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many-to-many: workspace membership + role
create type workspace_role as enum ('owner', 'editor', 'viewer');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role workspace_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- -----------------------------------------------------------------------------
-- FOLDERS (nested structure via self-referencing parent_id)
-- -----------------------------------------------------------------------------
create table public.folders (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- DOCUMENTS
-- -----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default 'Untitled',
  -- TipTap/ProseMirror JSON document content (source of truth between Yjs syncs)
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- Binary Yjs CRDT state snapshot, base64-encoded, for fast reconnect/rehydrate
  yjs_state text,
  icon text,
  is_pinned boolean not null default false,
  is_daily_note boolean not null default false,
  daily_note_date date,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_workspace on public.documents(workspace_id);
create index idx_documents_folder on public.documents(folder_id);
create index idx_documents_daily_note on public.documents(daily_note_date) where is_daily_note;
-- Full text search over title + flattened content
create index idx_documents_search on public.documents
  using gin (to_tsvector('english', title || ' ' || coalesce(content::text, '')));

-- -----------------------------------------------------------------------------
-- TAGS (many-to-many via document_tags)
-- -----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  unique (workspace_id, name)
);

create table public.document_tags (
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

-- -----------------------------------------------------------------------------
-- FILE CONVERSIONS (async job tracking for the File Tools module)
-- -----------------------------------------------------------------------------
create type conversion_status as enum ('queued', 'processing', 'completed', 'failed');
create type conversion_kind as enum (
  'pdf_to_docx', 'docx_to_pdf', 'txt_md_to_pdf', 'md_to_html',
  'xlsx_to_csv', 'csv_to_xlsx', 'xlsx_to_json',
  'pdf_page_to_image', 'image_to_pdf', 'heic_to_jpg', 'svg_to_png', 'svg_to_pdf',
  'audio_convert', 'audio_video_transcribe', 'video_to_gif', 'video_to_mp3',
  'zip_extract', 'zip_compress'
);

create table public.file_conversions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references public.users(id),
  kind conversion_kind not null,
  status conversion_status not null default 'queued',
  source_path text not null,       -- Supabase Storage path of the input file
  result_path text,                -- Supabase Storage path of the output file
  error_message text,
  metadata jsonb default '{}'::jsonb, -- e.g. { "pages": 12, "durationSec": 34 }
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_conversions_workspace on public.file_conversions(workspace_id);
create index idx_conversions_status on public.file_conversions(status);

-- -----------------------------------------------------------------------------
-- updated_at auto-touch trigger (reused across tables)
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger touch_workspaces before update on public.workspaces
  for each row execute procedure public.touch_updated_at();
create trigger touch_documents before update on public.documents
  for each row execute procedure public.touch_updated_at();
create trigger touch_users before update on public.users
  for each row execute procedure public.touch_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.tags enable row level security;
alter table public.document_tags enable row level security;
alter table public.file_conversions enable row level security;

-- Helper: is the current user a member of a given workspace?
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: does the current user have editor/owner rights on a workspace?
create or replace function public.can_edit_workspace(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$ language sql security definer stable;

-- USERS: users can read any profile (for collaborator display) but only edit their own
create policy "Users are publicly readable" on public.users
  for select using (true);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- WORKSPACES: members can read; only owner can update/delete
create policy "Members can view workspace" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "Owner can update workspace" on public.workspaces
  for update using (owner_id = auth.uid());
create policy "Owner can delete workspace" on public.workspaces
  for delete using (owner_id = auth.uid());
create policy "Authenticated users can create workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());

-- WORKSPACE MEMBERS: members can view roster; only owner manages membership
create policy "Members can view roster" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "Owner manages membership" on public.workspace_members
  for all using (
    exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

-- FOLDERS
create policy "Members can view folders" on public.folders
  for select using (public.is_workspace_member(workspace_id));
create policy "Editors can manage folders" on public.folders
  for all using (public.can_edit_workspace(workspace_id));

-- DOCUMENTS
create policy "Members can view documents" on public.documents
  for select using (public.is_workspace_member(workspace_id));
create policy "Editors can insert documents" on public.documents
  for insert with check (public.can_edit_workspace(workspace_id));
create policy "Editors can update documents" on public.documents
  for update using (public.can_edit_workspace(workspace_id));
create policy "Editors can delete documents" on public.documents
  for delete using (public.can_edit_workspace(workspace_id));

-- TAGS
create policy "Members can view tags" on public.tags
  for select using (public.is_workspace_member(workspace_id));
create policy "Editors can manage tags" on public.tags
  for all using (public.can_edit_workspace(workspace_id));

-- DOCUMENT_TAGS (join table — check via parent document's workspace)
create policy "Members can view document_tags" on public.document_tags
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_workspace_member(d.workspace_id)
    )
  );
create policy "Editors can manage document_tags" on public.document_tags
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.can_edit_workspace(d.workspace_id)
    )
  );

-- FILE CONVERSIONS
create policy "Members can view conversions" on public.file_conversions
  for select using (public.is_workspace_member(workspace_id));
create policy "Editors can request conversions" on public.file_conversions
  for insert with check (public.can_edit_workspace(workspace_id) and requested_by = auth.uid());
create policy "Editors can update own conversions" on public.file_conversions
  for update using (public.can_edit_workspace(workspace_id));

-- =============================================================================
-- REALTIME: expose tables to Supabase Realtime (for cursors, presence, live doc list)
-- =============================================================================
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.file_conversions;
alter publication supabase_realtime add table public.workspace_members;

-- Allow authenticated users to insert their own profile row
-- (needed when user signs up before handle_new_user trigger existed)
create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);
