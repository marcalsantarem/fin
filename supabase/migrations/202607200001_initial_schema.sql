create extension if not exists pgcrypto;

create type public.account_type as enum ('checking','digital','cash','savings','investment','other');
create type public.transaction_type as enum ('income','expense');
create type public.transaction_status as enum ('pending','paid','overdue','cancelled','scheduled');
create type public.recurrence_frequency as enum ('weekly','monthly','quarterly','semiannual','annual');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  default_currency char(3) not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.account_type not null default 'checking',
  initial_balance_cents bigint not null default 0,
  current_balance_cents bigint not null default 0,
  color text not null default '#315c4d',
  icon text not null default 'landmark',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id),
  name text not null,
  limit_amount_cents bigint not null check (limit_amount_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  color text not null default '#315c4d',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.transaction_type not null,
  parent_id uuid references public.categories(id),
  color text not null default '#718079',
  icon text not null default 'tag',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique nulls not distinct (user_id, name, type, parent_id)
);

create table public.installment_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  total_amount_cents bigint not null check (total_amount_cents > 0),
  installments_count integer not null check (installments_count > 1),
  first_due_date date not null,
  category_id uuid references public.categories(id),
  account_id uuid references public.accounts(id),
  credit_card_id uuid references public.credit_cards(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((account_id is not null)::int + (credit_card_id is not null)::int = 1)
);

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  type public.transaction_type not null default 'expense',
  frequency public.recurrence_frequency not null default 'monthly',
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  category_id uuid references public.categories(id),
  account_id uuid references public.accounts(id),
  credit_card_id uuid references public.credit_cards(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  transaction_date date not null,
  due_date date,
  paid_date date,
  competence_month date not null check (extract(day from competence_month) = 1),
  account_id uuid references public.accounts(id),
  credit_card_id uuid references public.credit_cards(id),
  category_id uuid references public.categories(id),
  status public.transaction_status not null default 'pending',
  payment_method text,
  notes text,
  installment_group_id uuid references public.installment_groups(id),
  recurrence_id uuid references public.recurrences(id),
  installment_number integer,
  installments_total integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'paid' and paid_date is not null) or status <> 'paid'),
  check ((installment_group_id is null and installment_number is null and installments_total is null) or
         (installment_group_id is not null and installment_number between 1 and installments_total))
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  month date not null check (extract(day from month) = 1),
  limit_amount_cents bigint not null check (limit_amount_cents > 0),
  alert_percentage smallint not null default 80 check (alert_percentage between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, category_id, month)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index transactions_user_competence_idx on public.transactions(user_id, competence_month) where deleted_at is null;
create index transactions_user_due_idx on public.transactions(user_id, due_date, status) where deleted_at is null;
create index transactions_card_idx on public.transactions(credit_card_id, due_date) where deleted_at is null;
create index categories_user_parent_idx on public.categories(user_id, parent_id) where deleted_at is null;
create index installments_user_idx on public.installment_groups(user_id) where deleted_at is null;
create index recurrences_user_active_idx on public.recurrences(user_id, active) where deleted_at is null;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','accounts','credit_cards','categories','transactions','installment_groups','recurrences','budgets'] loop
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare food_id uuid;
begin
  insert into public.profiles(user_id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  insert into public.categories(user_id,name,type,color,icon) values
    (new.id,'Moradia','expense','#315c4d','home'),
    (new.id,'Alimentação','expense','#d9a441','utensils'),
    (new.id,'Transporte','expense','#cb6d55','car'),
    (new.id,'Saúde','expense','#769786','heart-pulse'),
    (new.id,'Educação','expense','#6f74a7','graduation-cap'),
    (new.id,'Lazer','expense','#9b6c8b','sparkles'),
    (new.id,'Assinaturas','expense','#4b7691','refresh-cw'),
    (new.id,'Dívidas','expense','#b55c55','receipt-text'),
    (new.id,'Cartão de crédito','expense','#715687','credit-card'),
    (new.id,'Trabalho','income','#2d765d','briefcase-business'),
    (new.id,'Outros','expense','#718079','tag');
  select id into food_id from public.categories where user_id = new.id and name = 'Alimentação' and parent_id is null;
  insert into public.categories(user_id,name,type,parent_id,color,icon) values
    (new.id,'Mercado','expense',food_id,'#d9a441','shopping-basket'),
    (new.id,'Restaurante','expense',food_id,'#d9a441','utensils'),
    (new.id,'Delivery','expense',food_id,'#d9a441','bike');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_installment_plan(
  p_description text, p_total_amount_cents bigint, p_count integer, p_first_due_date date,
  p_category_id uuid, p_account_id uuid default null, p_credit_card_id uuid default null, p_notes text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare group_id uuid; base_amount bigint; remainder bigint; n integer; installment_amount bigint; due_date_value date;
begin
  if p_count < 2 or p_total_amount_cents < p_count then raise exception 'Invalid installment plan'; end if;
  insert into installment_groups(user_id,description,total_amount_cents,installments_count,first_due_date,category_id,account_id,credit_card_id,notes)
  values(auth.uid(),p_description,p_total_amount_cents,p_count,p_first_due_date,p_category_id,p_account_id,p_credit_card_id,p_notes) returning id into group_id;
  base_amount := p_total_amount_cents / p_count; remainder := p_total_amount_cents % p_count;
  for n in 1..p_count loop
    installment_amount := base_amount + case when n <= remainder then 1 else 0 end;
    due_date_value := (p_first_due_date + make_interval(months => n - 1))::date;
    insert into transactions(user_id,type,description,amount_cents,transaction_date,due_date,competence_month,account_id,credit_card_id,category_id,status,notes,installment_group_id,installment_number,installments_total)
    values(auth.uid(),'expense',p_description,installment_amount,current_date,due_date_value,date_trunc('month',due_date_value)::date,p_account_id,p_credit_card_id,p_category_id,'pending',p_notes,group_id,n,p_count);
  end loop;
  return group_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.installment_groups enable row level security;
alter table public.recurrences enable row level security;
alter table public.budgets enable row level security;
alter table public.attachments enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','accounts','credit_cards','categories','transactions','installment_groups','recurrences','budgets','attachments'] loop
    execute format('create policy "%s_select_own" on public.%I for select using ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy "%s_insert_own" on public.%I for insert with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy "%s_update_own" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy "%s_delete_own" on public.%I for delete using ((select auth.uid()) = user_id)', table_name, table_name);
  end loop;
end $$;

grant execute on function public.create_installment_plan(text,bigint,integer,date,uuid,uuid,uuid,text) to authenticated;
