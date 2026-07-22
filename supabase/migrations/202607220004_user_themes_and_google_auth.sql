-- FIN themes are durable profile preferences. Google OAuth users already flow
-- through auth.users and therefore use the existing handle_new_user trigger.
-- This migration is intentionally non-destructive: OAuth does not require
-- deleting financial history or recreating accounts.

alter table public.profiles
  add column if not exists theme text not null default 'classic',
  add column if not exists color_mode text not null default 'system';

update public.profiles
set theme = 'classic'
where theme not in ('classic', 'atelier', 'pulse');

update public.profiles
set color_mode = 'system'
where color_mode not in ('light', 'dark', 'system');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_check
      check (theme in ('classic', 'atelier', 'pulse'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_color_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_color_mode_check
      check (color_mode in ('light', 'dark', 'system'));
  end if;
end $$;

comment on column public.profiles.theme is
  'User-selected FIN interface: classic, atelier, or pulse.';

comment on column public.profiles.color_mode is
  'User-selected color mode: light, dark, or system.';
