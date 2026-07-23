import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FIN authentication bridge", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FIN<\/title>/i);
  assert.match(html, /name="application-name" content="FIN"/i);
  assert.match(html, /Preparando seu espaço/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps Supabase auth and data access wired to the FIN UI", async () => {
  const [app, client, data, envExample, grantMigration] = await Promise.all([
    readFile(new URL("../app/fin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607210002_authenticated_api_access.sql", import.meta.url), "utf8"),
  ]);

  assert.match(client, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_/);
  assert.match(data, /loadFinanceData/);
  assert.match(data, /from\("transactions"\)/);
  assert.match(app, /signInWithPassword/);
  assert.match(app, /signUp/);
  assert.match(app, /from\("transactions"\)\.insert/);
  assert.match(app, /create_installment_plan/);
  assert.doesNotMatch(app, /initialTransactions/);
  assert.match(grantMigration, /grant select, insert, update, delete/i);
  assert.match(grantMigration, /to authenticated/i);
  assert.match(grantMigration, /revoke all[\s\S]*from anon/i);
});

test("wires sensitive actions, responsive themes, and tenant integrity protections", async () => {
  const [app, styles, data, migration, themeMigration, expandedThemeMigration, resetMigration, vertexMigration, nineThemeMigration] = await Promise.all([
    readFile(new URL("../app/fin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607210003_integrity_and_security.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607220004_user_themes_and_google_auth.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607220005_expand_theme_collection.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607220006_responsive_reset_and_unlimited_cards.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607220007_vertex_theme_and_installment_deletion.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607230008_expand_to_nine_themes.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /auth\.getUser\(\)/);
  assert.match(app, /signInWithPassword\(\{ email: user\.email, password: currentPassword \}\)/);
  assert.match(app, /auth\.updateUser\(\{ password \}\)/);
  assert.match(app, /signInWithOAuth\(\{ provider: "google"/);
  assert.match(app, /Clássico/);
  assert.match(app, /Ateliê/);
  assert.match(app, /Pulse/);
  assert.match(app, /Lumen/);
  assert.match(app, /Aurora/);
  assert.match(app, /Vértice/);
  assert.match(app, /Sumi/);
  assert.match(app, /Dopamina/);
  assert.match(app, /Terminal 84/);
  assert.match(app, /id: "planning", label: "Planejamento"/);
  assert.match(app, /function isRealized\(transaction: TransactionRow\) \{ return transaction\.status === "paid"; \}/);
  assert.match(app, /function isForecast\(transaction: TransactionRow\)/);
  assert.match(app, /function PlanningScreen\(\{ transactions, accounts, cards, recurrences, onNew \}/);
  assert.match(app, /recurrence\.active && recurrence\.type === "expense" && recurrence\.frequency === "monthly"/);
  assert.match(app, /materializedOccurrences\.has\(`\$\{recurrence\.id\}:\$\{month\}`\)/);
  assert.match(app, /projectionThrough = \(month: string\) => currentBalance \+ forecast\.filter[\s\S]*- recurringExpenseThrough\(month\)/);
  assert.match(app, /status === "recurring" \? "Recorrente"/);
  assert.match(app, /type="month" min=\{currentMonth\}/);
  assert.match(app, /Os totais consideram apenas valores já pagos ou recebidos/);
  assert.match(app, /Consolidação somente do que já foi pago ou recebido/);
  assert.match(app, /from\("profiles"\)\.update\(\{ theme: nextTheme, color_mode: nextMode \}\)/);
  assert.match(app, /Ações de \$\{recurrence\.description\}/);
  assert.match(app, /onEdit\(category\)/);
  assert.match(app, /Nova subcategoria/);
  assert.match(app, /parent_id: parentId/);
  assert.match(app, /aria-controls=\{regionId\}/);
  assert.doesNotMatch(app, /category-guide|category-stats/);
  assert.match(app, /CategoryOptions categories=\{compatible\}/);
  assert.match(app, /isCategoryAvailable/);
  assert.match(app, /role="tab" aria-selected=\{tab === "security"\}/);
  assert.match(app, /role="tab" aria-selected=\{tab === "appearance"\}/);
  assert.match(app, /signInWithPassword\(\{ email: user\.email, password: currentPassword \}\)[\s\S]*rpc\("reset_finance_data"\)/);
  assert.match(app, /Cartão sem limite predefinido/);
  assert.match(app, /has_limit: !value\.unlimited/);
  assert.match(app, /rpc\("delete_installment_plan", \{ p_group_id: group\.id \}\)/);
  assert.match(app, /Excluir parcelamento/);
  assert.match(app, /className="transaction-table"/);
  assert.match(app, /data-label="Valor"/);
  assert.match(app, /Seu dinheiro\./);
  assert.match(app, /Mais claro\./);
  assert.doesNotMatch(app, /auth-theme-showcase/);
  assert.doesNotMatch(app, /auth-proof/);
  assert.doesNotMatch(app, /secure-note/);
  assert.doesNotMatch(app, /card\.id\.slice\(-4\)/);
  assert.doesNotMatch(app, /service[_-]role/i);
  assert.doesNotMatch(app, /Conectando ao Supabase|Sincronizando com o Supabase|Dados sincronizados com o Supabase|salvo diretamente no Supabase|políticas RLS|criadas pelo Supabase|armazenadas no Supabase/);

  assert.match(styles, /\[data-design="lumen"\] \.account-total/);
  assert.match(styles, /\[data-design="aurora"\] \.account-total/);
  assert.match(styles, /\[data-theme="dark"\] \.status-pago/);
  assert.match(styles, /\[data-theme="dark"\] \.status-recorrente/);
  assert.match(styles, /\[data-theme="dark"\] \.metric-icon\.green/);
  assert.match(styles, /Readable application typography/);
  assert.match(styles, /\.tx-main strong \{ font-size:13px; \}/);
  assert.match(styles, /\.category-legend > div,[\s\S]*font-size:11\.5px/);
  assert.match(styles, /input:not\(\[type="checkbox"\]\)[\s\S]*font-size:16px !important/);
  assert.match(styles, /\.theme-gallery \{ width:100%; grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.sidebar \{[^}]*overflow-y:auto;[^}]*overscroll-behavior:contain;/);
  assert.match(styles, /\[data-design="vertex"\] body/);
  assert.match(styles, /\[data-design="sumi"\] body/);
  assert.match(styles, /\[data-design="dopamine"\] body/);
  assert.match(styles, /\[data-design="terminal"\] body/);
  assert.match(styles, /--banner-height:/);
  assert.match(styles, /\[data-design\] \.account-total,[\s\S]*\[data-design\] \.planning-hero[\s\S]*height:var\(--banner-height\)/);
  assert.match(styles, /\.theme-gallery \{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.planning-hero\{[^}]*grid-template-columns/);
  assert.match(styles, /\.planning-item \{ grid-template-columns:38px minmax\(0,1fr\) auto; grid-template-areas:"date copy amount" "date status status"/);
  assert.match(styles, /\.transaction-table tr \{ width:100%; display:grid;[\s\S]*grid-template-areas:"description amount" "category amount"/);

  assert.match(data, /has_limit: boolean/);
  assert.match(data, /limit_amount_cents,has_limit,closing_day/);
  assert.match(data, /"aurora" \| "vertex" \| "sumi" \| "dopamine" \| "terminal"/);

  assert.match(migration, /create schema if not exists private/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /new\.user_id <> auth\.uid\(\)/i);
  assert.match(migration, /c\.user_id = new\.user_id/i);
  assert.match(migration, /to authenticated/i);
  assert.match(migration, /revoke all[\s\S]*from public, anon/i);
  assert.match(themeMigration, /add column if not exists theme/i);
  assert.match(themeMigration, /classic', 'atelier', 'pulse/i);
  assert.match(themeMigration, /color_mode/i);
  assert.doesNotMatch(themeMigration, /truncate|delete from|drop table/i);
  assert.match(expandedThemeMigration, /classic', 'atelier', 'pulse', 'lumen', 'aurora/i);
  assert.doesNotMatch(expandedThemeMigration, /truncate|delete from|drop table/i);
  assert.match(resetMigration, /add column if not exists has_limit boolean not null default true/i);
  assert.match(resetMigration, /create or replace function public\.reset_finance_data\(\)/i);
  assert.match(resetMigration, /security invoker[\s\S]*set search_path = ''/i);
  assert.match(resetMigration, /delete from public\.transactions where user_id = v_user_id/i);
  assert.match(resetMigration, /delete from public\.categories where user_id = v_user_id/i);
  assert.match(resetMigration, /grant execute on function public\.reset_finance_data\(\) to authenticated/i);
  assert.doesNotMatch(resetMigration, /security definer|service[_-]role/i);
  assert.match(vertexMigration, /classic', 'atelier', 'pulse', 'lumen', 'aurora', 'vertex/i);
  assert.match(vertexMigration, /create or replace function public\.delete_installment_plan\(p_group_id uuid\)/i);
  assert.match(vertexMigration, /security invoker[\s\S]*set search_path = ''/i);
  assert.match(vertexMigration, /update public\.transactions[\s\S]*user_id = v_user_id[\s\S]*installment_group_id = p_group_id/i);
  assert.match(vertexMigration, /update public\.installment_groups[\s\S]*user_id = v_user_id/i);
  assert.match(vertexMigration, /grant execute on function public\.delete_installment_plan\(uuid\) to authenticated/i);
  assert.doesNotMatch(vertexMigration, /security definer|service[_-]role/i);
  assert.match(nineThemeMigration, /classic[\s\S]*atelier[\s\S]*pulse[\s\S]*lumen[\s\S]*aurora[\s\S]*vertex[\s\S]*sumi[\s\S]*dopamine[\s\S]*terminal/i);
  assert.doesNotMatch(nineThemeMigration, /truncate|delete from|drop table/i);
});

test("keeps dedicated and compatible builds for Sites and Vercel", async () => {
  const [packageJson, viteConfig, vercelConfig, nitroConfig] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../nitro.config.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(packageJson.engines.node, "22.x");
  assert.equal(packageJson.scripts.build, "vinext build");
  assert.equal(packageJson.scripts["build:vercel"], "vite build");
  assert.ok(packageJson.devDependencies.nitro);
  assert.match(viteConfig, /process\.env\.VERCEL/);
  assert.match(viteConfig, /import\("nitro\/vite"\)/);
  assert.equal(vercelConfig.framework, "nitro");
  assert.equal(vercelConfig.buildCommand, "npm run build:vercel");
  assert.equal(vercelConfig.outputDirectory, null);
  assert.match(nitroConfig, /runtime: "nodejs22\.x"/);
});
