-- Expand FIN's persisted theme collection from six to nine interfaces.
-- Existing user choices remain unchanged.

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in (
    'classic',
    'atelier',
    'pulse',
    'lumen',
    'aurora',
    'vertex',
    'sumi',
    'dopamine',
    'terminal'
  ));

comment on column public.profiles.theme is
  'FIN interface theme: classic, atelier, pulse, lumen, aurora, vertex, sumi, dopamine or terminal.';
