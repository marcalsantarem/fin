-- Expand FIN's persisted theme collection from three to five interfaces.
-- Existing profile choices remain unchanged.

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('classic', 'atelier', 'pulse', 'lumen', 'aurora'));

comment on column public.profiles.theme is
  'User-selected FIN interface: classic, atelier, pulse, lumen, or aurora.';
