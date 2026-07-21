-- Defense in depth for FIN's multi-tenant financial data.
-- RLS protects rows; these triggers also guarantee that every referenced row
-- belongs to the same user, even when a UUID is supplied manually.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enforce_fin_row_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'User ownership mismatch' using errcode = '42501';
  end if;

  if tg_table_name = 'credit_cards' then
    if new.account_id is not null and not exists (
      select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id and a.deleted_at is null
    ) then raise exception 'Invalid account reference' using errcode = '23503'; end if;

  elsif tg_table_name = 'categories' then
    if new.parent_id = new.id then raise exception 'A category cannot be its own parent' using errcode = '23514'; end if;
    if new.parent_id is not null and not exists (
      select 1 from public.categories c where c.id = new.parent_id and c.user_id = new.user_id and c.type = new.type and c.deleted_at is null
    ) then raise exception 'Invalid parent category reference' using errcode = '23503'; end if;
    if tg_op = 'UPDATE' and old.type <> new.type and (
      exists (select 1 from public.transactions t where t.category_id = new.id and t.deleted_at is null)
      or exists (select 1 from public.recurrences r where r.category_id = new.id and r.deleted_at is null)
      or exists (select 1 from public.categories c where c.parent_id = new.id and c.deleted_at is null)
    ) then raise exception 'A category in use cannot change type' using errcode = '23514'; end if;

  elsif tg_table_name = 'installment_groups' then
    if new.category_id is not null and not exists (
      select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id and c.type = 'expense' and c.deleted_at is null
    ) then raise exception 'Invalid category reference' using errcode = '23503'; end if;
    if new.account_id is not null and not exists (
      select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id and a.deleted_at is null
    ) then raise exception 'Invalid account reference' using errcode = '23503'; end if;
    if new.credit_card_id is not null and not exists (
      select 1 from public.credit_cards c where c.id = new.credit_card_id and c.user_id = new.user_id and c.deleted_at is null
    ) then raise exception 'Invalid credit card reference' using errcode = '23503'; end if;

  elsif tg_table_name = 'recurrences' then
    if (new.account_id is not null)::int + (new.credit_card_id is not null)::int <> 1 then
      raise exception 'A recurrence must have exactly one source' using errcode = '23514';
    end if;
    if new.type = 'income' and new.credit_card_id is not null then
      raise exception 'Income recurrences require an account' using errcode = '23514';
    end if;
    if new.category_id is not null and not exists (
      select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id and c.type = new.type and c.deleted_at is null
    ) then raise exception 'Invalid category reference' using errcode = '23503'; end if;
    if new.account_id is not null and not exists (
      select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id and a.deleted_at is null
    ) then raise exception 'Invalid account reference' using errcode = '23503'; end if;
    if new.credit_card_id is not null and not exists (
      select 1 from public.credit_cards c where c.id = new.credit_card_id and c.user_id = new.user_id and c.deleted_at is null
    ) then raise exception 'Invalid credit card reference' using errcode = '23503'; end if;

  elsif tg_table_name = 'transactions' then
    if (new.account_id is not null)::int + (new.credit_card_id is not null)::int <> 1 then
      raise exception 'A transaction must have exactly one source' using errcode = '23514';
    end if;
    if new.type = 'income' and new.credit_card_id is not null then
      raise exception 'Income transactions require an account' using errcode = '23514';
    end if;
    if new.category_id is not null and not exists (
      select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id and c.type = new.type and c.deleted_at is null
    ) then raise exception 'Invalid category reference' using errcode = '23503'; end if;
    if new.account_id is not null and not exists (
      select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id and a.deleted_at is null
    ) then raise exception 'Invalid account reference' using errcode = '23503'; end if;
    if new.credit_card_id is not null and not exists (
      select 1 from public.credit_cards c where c.id = new.credit_card_id and c.user_id = new.user_id and c.deleted_at is null
    ) then raise exception 'Invalid credit card reference' using errcode = '23503'; end if;
    if new.installment_group_id is not null and not exists (
      select 1 from public.installment_groups i where i.id = new.installment_group_id and i.user_id = new.user_id and i.deleted_at is null
    ) then raise exception 'Invalid installment reference' using errcode = '23503'; end if;
    if new.recurrence_id is not null and not exists (
      select 1 from public.recurrences r where r.id = new.recurrence_id and r.user_id = new.user_id and r.deleted_at is null
    ) then raise exception 'Invalid recurrence reference' using errcode = '23503'; end if;

  elsif tg_table_name = 'budgets' then
    if not exists (
      select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id and c.type = 'expense' and c.deleted_at is null
    ) then raise exception 'Invalid category reference' using errcode = '23503'; end if;

  elsif tg_table_name = 'attachments' then
    if not exists (
      select 1 from public.transactions t where t.id = new.transaction_id and t.user_id = new.user_id and t.deleted_at is null
    ) then raise exception 'Invalid transaction reference' using errcode = '23503'; end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_fin_row_integrity() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['credit_cards','categories','installment_groups','recurrences','transactions','budgets','attachments'] loop
    execute format('drop trigger if exists enforce_%s_integrity on public.%I', table_name, table_name);
    execute format('create trigger enforce_%s_integrity before insert or update on public.%I for each row execute function private.enforce_fin_row_integrity()', table_name, table_name);
  end loop;
end $$;

-- Restrict every existing ownership policy to signed-in users explicitly.
do $$
declare table_name text;
declare operation text;
begin
  foreach table_name in array array['profiles','accounts','credit_cards','categories','transactions','installment_groups','recurrences','budgets','attachments'] loop
    foreach operation in array array['select','insert','update','delete'] loop
      execute format('alter policy %I on public.%I to authenticated', table_name || '_' || operation || '_own', table_name);
    end loop;
  end loop;
end $$;

-- Recreate the installment RPC with explicit ownership and source validation.
create or replace function public.create_installment_plan(
  p_description text, p_total_amount_cents bigint, p_count integer, p_first_due_date date,
  p_category_id uuid, p_account_id uuid default null, p_credit_card_id uuid default null, p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  group_id uuid;
  base_amount bigint;
  remainder bigint;
  n integer;
  installment_amount bigint;
  due_date_value date;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_description, ''))) < 2 or length(p_description) > 160 then raise exception 'Invalid description' using errcode = '22023'; end if;
  if p_count < 2 or p_count > 360 or p_total_amount_cents < p_count then raise exception 'Invalid installment plan' using errcode = '22023'; end if;
  if (p_account_id is not null)::int + (p_credit_card_id is not null)::int <> 1 then raise exception 'Exactly one source is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.user_id = v_user_id and c.type = 'expense' and c.deleted_at is null) then raise exception 'Invalid category' using errcode = '23503'; end if;
  if p_account_id is not null and not exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = v_user_id and a.deleted_at is null) then raise exception 'Invalid account' using errcode = '23503'; end if;
  if p_credit_card_id is not null and not exists (select 1 from public.credit_cards c where c.id = p_credit_card_id and c.user_id = v_user_id and c.deleted_at is null) then raise exception 'Invalid credit card' using errcode = '23503'; end if;

  insert into public.installment_groups(user_id,description,total_amount_cents,installments_count,first_due_date,category_id,account_id,credit_card_id,notes)
  values(v_user_id,trim(p_description),p_total_amount_cents,p_count,p_first_due_date,p_category_id,p_account_id,p_credit_card_id,left(p_notes,500)) returning id into group_id;
  base_amount := p_total_amount_cents / p_count;
  remainder := p_total_amount_cents % p_count;
  for n in 1..p_count loop
    installment_amount := base_amount + case when n <= remainder then 1 else 0 end;
    due_date_value := (p_first_due_date + make_interval(months => n - 1))::date;
    insert into public.transactions(user_id,type,description,amount_cents,transaction_date,due_date,competence_month,account_id,credit_card_id,category_id,status,notes,installment_group_id,installment_number,installments_total)
    values(v_user_id,'expense',trim(p_description),installment_amount,current_date,due_date_value,date_trunc('month',due_date_value)::date,p_account_id,p_credit_card_id,p_category_id,'pending',left(p_notes,500),group_id,n,p_count);
  end loop;
  return group_id;
end;
$$;

revoke all on function public.create_installment_plan(text,bigint,integer,date,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.create_installment_plan(text,bigint,integer,date,uuid,uuid,uuid,text) to authenticated;
