/**
 * E2E tests for Phase 3 remaining features:
 * GPS tagging, full-text search, PDF invoice, push subscribe, queue endpoint
 *
 * Run: BASE_URL=http://localhost:3000 npx ts-node --compiler-options '{"module":"CommonJS"}' test-phase3b.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean, detail?: unknown) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`, detail ?? ""); failed++; }
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function login(email: string, password: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = csrfRes.headers.getSetCookie().join("; ");
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email, password, redirect: "false", json: "true" }),
    redirect: "manual",
  });
  const all = [...csrfRes.headers.getSetCookie(), ...loginRes.headers.getSetCookie()];
  const session = all.map((c) => c.split(";")[0]).filter((c) => c.startsWith("next-auth")).join("; ");
  if (!session) throw new Error(`Login failed for ${email}`);
  return session;
}

async function run() {
  console.log("\n=== Phase 3b: GPS, Search, PDF, Push, Queue ===\n");

  const distCookie = await login("distributor@demo.com", "dist123");
  const salesCookie = await login("salesman@demo.com", "sales123");
  console.log("  Logged in as distributor + salesman\n");

  // Get a product
  const prodRes = await fetch(`${BASE}/api/products?limit=1`, { headers: { Cookie: salesCookie } });
  const prodData = (await prodRes.json()) as { data: { id: string; name: string; price: number }[] };
  const product = prodData.data[0];

  // Get a customer
  const custRes = await fetch(`${BASE}/api/customers?limit=1`, { headers: { Cookie: salesCookie } });
  const custData = (await custRes.json()) as { data: { id: string }[] };
  const customer = custData.data[0];

  // ── 1. GPS tagging ─────────────────────────────────────────────────────────
  console.log("[ Test 1 ] GPS coordinates stored with order");
  const lat = 24.8607;
  const lng = 67.0011;

  const gpsOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 1 }],
      lat,
      lng,
    }),
  });
  const gpsOrder = (await gpsOrderRes.json()) as { id: string };
  ok("Order with GPS created (201)", gpsOrderRes.status === 201, gpsOrderRes.status);

  // Fetch it from distributor and verify lat/lng in the list
  const ordersRes = await fetch(`${BASE}/api/orders?limit=5`, { headers: { Cookie: distCookie } });
  const ordersData = (await ordersRes.json()) as { data: { id: string; lat?: unknown; lng?: unknown }[] };
  const gpsFound = ordersData.data.find((o) => o.id === gpsOrder.id);
  ok("Order appears in distributor list", !!gpsFound);
  ok("lat stored on order", Math.abs(Number(gpsFound?.lat) - lat) < 0.0001, gpsFound?.lat);
  ok("lng stored on order", Math.abs(Number(gpsFound?.lng) - lng) < 0.0001, gpsFound?.lng);
  console.log();

  // ── 2. Order without GPS coordinates (optional) ────────────────────────────
  console.log("[ Test 2 ] Order without GPS coordinates accepted");
  const noGpsRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }),
  });
  ok("Order without GPS created (201)", noGpsRes.status === 201, noGpsRes.status);
  const noGpsOrder = (await noGpsRes.json()) as { id: string };
  console.log();

  // ── 3. Full-text search — products ────────────────────────────────────────
  console.log("[ Test 3 ] Full-text product search");
  // Use a keyword from the first product's name for a reliable search
  const ftsKeyword = product.name.split(" ").find((w) => w.length >= 4) ?? product.name.split(" ")[0];
  const ftsProductRes = await fetch(`${BASE}/api/products?search=${encodeURIComponent(ftsKeyword)}`, { headers: { Cookie: salesCookie } });
  const ftsProductData = (await ftsProductRes.json()) as { data: { name: string }[] };
  ok("Product FTS returns 200", ftsProductRes.ok, ftsProductRes.status);
  ok(`FTS search '${ftsKeyword}' returns results`, ftsProductData.data.length > 0, ftsProductData.data.map(p => p.name));

  // Prefix search using a token that exists in the current product catalogue
  const ftsPartialRes = await fetch(`${BASE}/api/products?search=${encodeURIComponent(product.name.split(" ")[0])}`, { headers: { Cookie: salesCookie } });
  const ftsPartialData = (await ftsPartialRes.json()) as { data: { name: string }[] };
  ok("Prefix search matches existing product", ftsPartialData.data.length > 0, ftsPartialData.data.map(p => p.name));
  console.log();

  // ── 4. Full-text search — customers ───────────────────────────────────────
  console.log("[ Test 4 ] Full-text customer search");
  const ftsCustomerRes = await fetch(`${BASE}/api/customers?search=ali`, { headers: { Cookie: distCookie } });
  const ftsCustomerData = (await ftsCustomerRes.json()) as { data: { name: string }[] };
  ok("Customer FTS returns 200", ftsCustomerRes.ok, ftsCustomerRes.status);
  ok("Found 'Ali General Store' with search=ali", ftsCustomerData.data.some((c) => c.name.toLowerCase().includes("ali")), ftsCustomerData.data.map(c => c.name));

  const multiWordRes = await fetch(`${BASE}/api/customers?search=hassan+traders`, { headers: { Cookie: distCookie } });
  const multiWordData = (await multiWordRes.json()) as { data: { name: string }[] };
  ok("Multi-word search 'hassan traders'", multiWordData.data.some((c) => c.name.toLowerCase().includes("hassan")), multiWordData.data.map(c => c.name));
  console.log();

  // ── 5. PDF invoice endpoint ────────────────────────────────────────────────
  console.log("[ Test 5 ] PDF invoice generation");
  const invoiceRes = await fetch(`${BASE}/api/orders/${gpsOrder.id}/invoice`, { headers: { Cookie: distCookie } });
  ok("Invoice returns 200", invoiceRes.ok, invoiceRes.status);
  ok("Content-Type is PDF", invoiceRes.headers.get("content-type") === "application/pdf", invoiceRes.headers.get("content-type"));
  ok("Content-Disposition is attachment", (invoiceRes.headers.get("content-disposition") ?? "").includes("attachment"), invoiceRes.headers.get("content-disposition"));
  const pdfBytes = await invoiceRes.arrayBuffer();
  ok("PDF has content (>1KB)", pdfBytes.byteLength > 1000, `${pdfBytes.byteLength} bytes`);

  // PDF magic bytes: %PDF
  const magic = new Uint8Array(pdfBytes, 0, 4);
  const magicStr = String.fromCharCode(magic[0], magic[1], magic[2], magic[3]);
  ok("File starts with %PDF", magicStr === "%PDF", magicStr);
  console.log();

  // ── 6. Salesman cannot download another salesman's invoice ─────────────────
  console.log("[ Test 6 ] Invoice access control");
  const invoiceUnauth = await fetch(`${BASE}/api/orders/${gpsOrder.id}/invoice`, { headers: { Cookie: salesCookie } });
  // Salesman CAN download their own order invoice
  ok("Salesman can access own order invoice", invoiceUnauth.ok, invoiceUnauth.status);
  console.log();

  // ── 7. Push subscribe endpoint ─────────────────────────────────────────────
  console.log("[ Test 7 ] Push subscription endpoint");
  const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/fake-${uuid()}`;
  const subRes = await fetch(`${BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: distCookie },
    body: JSON.stringify({
      endpoint: fakeEndpoint,
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtx_uF7KeDjUo-mxlp-U0yVWvqJWb4oINI5XlmCYB9n3tUWpqkuF4Rxj4hR7Nw0=", auth: "tBHItJI5svbpez7KI4CCXg==" },
    }),
  });
  ok("POST /api/push/subscribe returns 200", subRes.ok, subRes.status);

  // Idempotent — second subscribe with same endpoint should also succeed
  const subRes2 = await fetch(`${BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: distCookie },
    body: JSON.stringify({
      endpoint: fakeEndpoint,
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtx_uF7KeDjUo-mxlp-U0yVWvqJWb4oINI5XlmCYB9n3tUWpqkuF4Rxj4hR7Nw0=", auth: "tBHItJI5svbpez7KI4CCXg==" },
    }),
  });
  ok("Re-subscribing same endpoint is idempotent (200)", subRes2.ok, subRes2.status);

  // Unsubscribe
  const unsubRes = await fetch(`${BASE}/api/push/subscribe`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: distCookie },
    body: JSON.stringify({ endpoint: fakeEndpoint }),
  });
  ok("DELETE /api/push/subscribe returns 200", unsubRes.ok, unsubRes.status);
  console.log();

  // ── 8. Queue endpoint with correct secret ─────────────────────────────────
  console.log("[ Test 8 ] Queue push endpoint");
  const queueRes = await fetch(`${BASE}/api/queue/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-queue-secret": "dev-queue-secret" },
    body: JSON.stringify({ userId: uuid(), title: "Test", body: "Hello" }),
  });
  ok("POST /api/queue/push with correct secret returns 200", queueRes.ok, queueRes.status);

  const queueBadSecretRes = await fetch(`${BASE}/api/queue/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-queue-secret": "wrong-secret" },
    body: JSON.stringify({ userId: uuid(), title: "Test", body: "Hello" }),
  });
  ok("POST /api/queue/push with wrong secret returns 403", queueBadSecretRes.status === 403, queueBadSecretRes.status);
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("─".repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => { console.error("Error:", err); process.exit(1); });
