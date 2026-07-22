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
  assert.match(html, /Conectando ao Supabase/);
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

test("wires sensitive actions and tenant integrity protections", async () => {
  const [app, migration, themeMigration] = await Promise.all([
    readFile(new URL("../app/fin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607210003_integrity_and_security.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607220004_user_themes_and_google_auth.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /auth\.getUser\(\)/);
  assert.match(app, /signInWithPassword\(\{ email: user\.email, password: currentPassword \}\)/);
  assert.match(app, /auth\.updateUser\(\{ password \}\)/);
  assert.match(app, /signInWithOAuth\(\{ provider: "google"/);
  assert.match(app, /Clássico/);
  assert.match(app, /Ateliê/);
  assert.match(app, /Pulse/);
  assert.match(app, /from\("profiles"\)\.update\(\{ theme: nextTheme, color_mode: nextMode \}\)/);
  assert.match(app, /Ações de \$\{recurrence\.description\}/);
  assert.match(app, /onEdit\(category\)/);
  assert.match(app, /Nova subcategoria/);
  assert.match(app, /parent_id: parentId/);
  assert.match(app, /aria-controls=\{regionId\}/);
  assert.match(app, /CategoryOptions categories=\{compatible\}/);
  assert.match(app, /isCategoryAvailable/);
  assert.match(app, /role="tab" aria-selected=\{tab === "security"\}/);
  assert.match(app, /role="tab" aria-selected=\{tab === "appearance"\}/);
  assert.doesNotMatch(app, /card\.id\.slice\(-4\)/);
  assert.doesNotMatch(app, /service[_-]role/i);

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
