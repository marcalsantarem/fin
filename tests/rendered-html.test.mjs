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
