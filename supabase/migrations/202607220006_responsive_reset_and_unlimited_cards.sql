-- Support cards without a predefined spending limit.
alter table public.credit_cards
  add column if not exists has_limit boolean not null default true;

update public.credit_cards
set has_limit = false
where limit_amount_cents = 0;

alter table public.credit_cards
  drop constraint if exists credit_cards_limit_configuration_check;

alter table public.credit_cards
  add constraint credit_cards_limit_configuration_check
  check (
    (has_limit and limit_amount_cents > 0)
    or (not has_limit and limit_amount_cents = 0)
  ) not valid;

alter table public.credit_cards
  validate constraint credit_cards_limit_configuration_check;

-- Atomically remove only the signed-in user's financial records and restore
-- the same starter categories created by handle_new_user. Authentication is
-- intentionally preserved; the client confirms the current password first.
create or replace function public.reset_finance_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_food_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.attachments where user_id = v_user_id;
  delete from public.transactions where user_id = v_user_id;
  delete from public.budgets where user_id = v_user_id;
  delete from public.recurrences where user_id = v_user_id;
  delete from public.installment_groups where user_id = v_user_id;
  delete from public.credit_cards where user_id = v_user_id;
  delete from public.accounts where user_id = v_user_id;
  delete from public.categories where user_id = v_user_id;

  update public.profiles
  set default_currency = 'BRL', theme = 'classic', color_mode = 'system'
  where user_id = v_user_id;

  insert into public.categories(user_id, name, type, color, icon) values
    (v_user_id, 'Moradia', 'expense', '#315c4d', 'home'),
    (v_user_id, 'Alimentação', 'expense', '#d9a441', 'utensils'),
    (v_user_id, 'Transporte', 'expense', '#cb6d55', 'car'),
    (v_user_id, 'Saúde', 'expense', '#769786', 'heart-pulse'),
    (v_user_id, 'Educação', 'expense', '#6f74a7', 'graduation-cap'),
    (v_user_id, 'Lazer', 'expense', '#9b6c8b', 'sparkles'),
    (v_user_id, 'Assinaturas', 'expense', '#4b7691', 'refresh-cw'),
    (v_user_id, 'Dívidas', 'expense', '#b55c55', 'receipt-text'),
    (v_user_id, 'Cartão de crédito', 'expense', '#715687', 'credit-card'),
    (v_user_id, 'Trabalho', 'income', '#2d765d', 'briefcase-business'),
    (v_user_id, 'Outros', 'expense', '#718079', 'tag');

  select id into v_food_id
  from public.categories
  where user_id = v_user_id
    and name = 'Alimentação'
    and type = 'expense'
    and parent_id is null;

  insert into public.categories(user_id, name, type, parent_id, color, icon) values
    (v_user_id, 'Mercado', 'expense', v_food_id, '#d9a441', 'shopping-basket'),
    (v_user_id, 'Restaurante', 'expense', v_food_id, '#d9a441', 'utensils'),
    (v_user_id, 'Delivery', 'expense', v_food_id, '#d9a441', 'bike');
end;
$$;

revoke all on function public.reset_finance_data() from public, anon;
grant execute on function public.reset_finance_data() to authenticated;
