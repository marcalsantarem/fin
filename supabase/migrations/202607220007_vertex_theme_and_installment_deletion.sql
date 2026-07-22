-- Add the sixth FIN theme and an atomic, tenant-scoped installment deletion.

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('classic', 'atelier', 'pulse', 'lumen', 'aurora', 'vertex'));

comment on column public.profiles.theme is
  'FIN interface theme: classic, atelier, pulse, lumen, aurora or vertex.';

create or replace function public.delete_installment_plan(p_group_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.installment_groups
    where id = p_group_id
      and user_id = v_user_id
      and deleted_at is null
  ) then
    raise exception 'Installment plan not found';
  end if;

  update public.transactions
  set deleted_at = now()
  where user_id = v_user_id
    and installment_group_id = p_group_id
    and deleted_at is null;

  update public.installment_groups
  set deleted_at = now()
  where id = p_group_id
    and user_id = v_user_id
    and deleted_at is null;
end;
$$;

revoke all on function public.delete_installment_plan(uuid) from public, anon;
grant execute on function public.delete_installment_plan(uuid) to authenticated;
