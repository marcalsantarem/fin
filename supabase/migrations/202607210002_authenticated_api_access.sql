-- Allow the Supabase Data API to operate on FIN tables for signed-in users.
-- Row Level Security remains the final authorization layer on every row.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.credit_cards,
  public.categories,
  public.transactions,
  public.installment_groups,
  public.recurrences,
  public.budgets,
  public.attachments
to authenticated;

revoke all on table
  public.profiles,
  public.accounts,
  public.credit_cards,
  public.categories,
  public.transactions,
  public.installment_groups,
  public.recurrences,
  public.budgets,
  public.attachments
from anon;

grant execute on function public.create_installment_plan(text,bigint,integer,date,uuid,uuid,uuid,text) to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Backfill profiles for users created before the initial trigger existed.
insert into public.profiles (user_id, name)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data->>'name', ''), split_part(users.email, '@', 1), '')
from auth.users as users
on conflict (user_id) do nothing;

-- Backfill the standard root categories without duplicating existing ones.
insert into public.categories (user_id, name, type, color, icon)
select users.id, defaults.name, defaults.type::public.transaction_type, defaults.color, defaults.icon
from auth.users as users
cross join (values
  ('Moradia','expense','#315c4d','home'),
  ('Alimentação','expense','#d9a441','utensils'),
  ('Transporte','expense','#cb6d55','car'),
  ('Saúde','expense','#769786','heart-pulse'),
  ('Educação','expense','#6f74a7','graduation-cap'),
  ('Lazer','expense','#9b6c8b','sparkles'),
  ('Assinaturas','expense','#4b7691','refresh-cw'),
  ('Dívidas','expense','#b55c55','receipt-text'),
  ('Cartão de crédito','expense','#715687','credit-card'),
  ('Trabalho','income','#2d765d','briefcase-business'),
  ('Outros','expense','#718079','tag')
) as defaults(name, type, color, icon)
where not exists (
  select 1 from public.categories existing
  where existing.user_id = users.id
    and existing.name = defaults.name
    and existing.type = defaults.type::public.transaction_type
    and existing.parent_id is null
);

-- Backfill Alimentação subcategories for the same pre-trigger users.
insert into public.categories (user_id, name, type, parent_id, color, icon)
select parent.user_id, defaults.name, 'expense', parent.id, '#d9a441', defaults.icon
from public.categories as parent
cross join (values
  ('Mercado','shopping-basket'),
  ('Restaurante','utensils'),
  ('Delivery','bike')
) as defaults(name, icon)
where parent.name = 'Alimentação'
  and parent.parent_id is null
  and parent.deleted_at is null
  and not exists (
    select 1 from public.categories existing
    where existing.user_id = parent.user_id
      and existing.parent_id = parent.id
      and existing.name = defaults.name
  );
