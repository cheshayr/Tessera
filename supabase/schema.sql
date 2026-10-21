-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create table public.workspaces (               -- one saved workspace per user
  owner uuid primary key references auth.users on delete cascade,
  state jsonb not null, device text,
  updated_at timestamptz not null default now()
);
create table public.shares (                   -- view-only links
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  owner uuid not null references auth.users on delete cascade,
  board_id text not null, title text, data jsonb not null,
  image_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (owner, board_id)
);

create function public.touch() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger t_ws before update on public.workspaces for each row execute function public.touch();
create trigger t_sh before update on public.shares for each row execute function public.touch();

-- Create the profile (username) when someone registers.
create function public.on_signup() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into profiles (id, username) values (new.id, new.raw_user_meta_data->>'username'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_signup();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.shares enable row level security;
create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "own workspace" on public.workspaces for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own shares" on public.shares for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- Public helpers (no login needed). Shares are readable ONLY by knowing the token.
create function public.username_available(p text) returns boolean language sql security definer set search_path = public as
$$ select not exists (select 1 from profiles where username = p) $$;
create function public.get_share(p_token text) returns jsonb language sql security definer set search_path = public as
$$ select jsonb_build_object('title', title, 'data', data, 'owner', owner, 'image_ids', image_ids, 'updated_at', updated_at)
   from shares where token = p_token $$;
grant execute on function public.username_available(text), public.get_share(text) to anon, authenticated;

-- Storage: private bucket for each user's images, public bucket for shared-link images.
insert into storage.buckets (id, name, public) values ('assets', 'assets', false), ('shared', 'shared', true) on conflict do nothing;
create policy "assets own" on storage.objects for all to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "shared own" on storage.objects for all to authenticated
  using (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shared' and (storage.foldername(name))[1] = auth.uid()::text);
