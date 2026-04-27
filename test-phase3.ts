/**
 * E2E tests for Phase 3 — credit limits
 *
 * Run with dev server up:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' test-phase3.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`, detail ?? "");
    failed++;
  }
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

  const allCookies = [...(csrfRes.headers.getSetCookie() ?? []), ...(loginRes.headers.getSetCookie() ?? [])];
  const session = allCookies
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("next-auth.session-token") || c.startsWith("__Secure-next-auth.session-token"))
    .join("; ");

  if (!session) throw new Error(`Login failed for ${email} — no session cookie`);
  return session;
}

async function run() {
  console.log("\n=== Phase 3: Credit Limit Tests ===\n");

  // ── Login ──────────────────────────────────────────────────────────────
  console.log("[ Setup ] Logging in...");
  const distCookie = await login("distributor@demo.com", "dist123");
  const salesCookie = await login("salesman@demo.com", "sales123");
  console.log("  Logged in as distributor + salesman\n");

  // ── Get a product to use ───────────────────────────────────────────────
  console.log("[ Setup ] Fetching a product...");
  const prodRes = await fetch(`${BASE}/api/products?limit=1`, { headers: { Cookie: salesCookie } });
  const prodData = (await prodRes.json()) as { data: { id: string; name: string; price: number }[] };
  ok("GET /api/products returns data", prodRes.ok && prodData.data.length > 0);
  const product = prodData.data[0];
  console.log(`  Using product: ${product.name} @ PKR ${product.price}\n`);

  // ── 1. Create customer with credit limit via POST /api/customers ────────
  console.log("[ Test 1 ] Create customer with credit limit");
  const custRes = await fetch(`${BASE}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: distCookie },
    body: JSON.stringify({ name: "Credit Test Shop", address: "123 Test St", creditLimit: 500 }),
  });
  const custData = (await custRes.json()) as { id: string; name: string; creditLimit: unknown };
  ok("POST /api/customers returns 201", custRes.status === 201);
  ok("Response includes creditLimit", custData.creditLimit !== undefined);
  ok("creditLimit equals 500", Number(custData.creditLimit) === 500, custData.creditLimit);
  const customerId = custData.id;
  console.log();

  // ── 2. GET /api/customers includes creditLimit ─────────────────────────
  console.log("[ Test 2 ] GET /api/customers includes creditLimit");
  const listRes = await fetch(`${BASE}/api/customers?search=Credit+Test`, { headers: { Cookie: distCookie } });
  const listData = (await listRes.json()) as { data: { id: string; creditLimit: unknown }[] };
  ok("GET /api/customers is 200", listRes.ok);
  const found = listData.data.find((c) => c.id === customerId);
  ok("Customer in list", !!found);
  ok("creditLimit in list item", found !== undefined && Number(found.creditLimit) === 500, found?.creditLimit);
  console.log();

  // ── 3. PATCH /api/customers/[id] — update credit limit ────────────────
  console.log("[ Test 3 ] PATCH /api/customers/[id] updates credit limit");
  const patchRes = await fetch(`${BASE}/api/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: distCookie },
    body: JSON.stringify({ creditLimit: 1000 }),
  });
  const patchData = (await patchRes.json()) as { creditLimit: unknown };
  ok("PATCH returns 200", patchRes.ok, await (patchRes.ok ? null : patchRes.clone().text()));
  ok("Updated creditLimit is 1000", Number(patchData.creditLimit) === 1000, patchData.creditLimit);

  // Reset limit back to 500 for enforcement tests
  await fetch(`${BASE}/api/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: distCookie },
    body: JSON.stringify({ creditLimit: 500 }),
  });
  console.log();

  // ── 4. PATCH by non-distributor is rejected ────────────────────────────
  console.log("[ Test 4 ] PATCH /api/customers/[id] by salesman is rejected");
  const patchSalesRes = await fetch(`${BASE}/api/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: salesCookie },
    body: JSON.stringify({ creditLimit: 999 }),
  });
  ok("Salesman PATCH returns 403", patchSalesRes.status === 403);
  console.log();

  // ── 5. Credit limit enforcement: order OVER limit rejected ─────────────
  console.log("[ Test 5 ] DRAFT→PENDING blocked when order exceeds credit limit");
  // price * qty > 500; e.g. price=80, qty=10 => 800
  const qty = Math.ceil(510 / Number(product.price));
  const overOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ customerId, items: [{ productId: product.id, quantity: qty }] }),
  });
  const overOrder = (await overOrderRes.json()) as { id: string };
  ok("Draft order created (over limit)", overOrderRes.status === 201, overOrderRes.status);

  const overStatusRes = await fetch(`${BASE}/api/orders/${overOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "PENDING" }),
  });
  const overStatusData = (await overStatusRes.json()) as { error?: { code: string; message: string } };
  ok("DRAFT→PENDING blocked with 422", overStatusRes.status === 422, overStatusRes.status);
  ok("Error code is CREDIT_LIMIT_EXCEEDED", overStatusData.error?.code === "CREDIT_LIMIT_EXCEEDED", overStatusData.error?.code);
  console.log(`  Message: ${overStatusData.error?.message}`);

  // Cancel the over-limit draft so it doesn't pollute outstanding balance
  await fetch(`${BASE}/api/orders/${overOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  console.log();

  // ── 6. Credit limit enforcement: order UNDER limit passes ──────────────
  console.log("[ Test 6 ] DRAFT→PENDING allowed when order is within credit limit");
  const underQty = Math.floor(400 / Number(product.price)) || 1;
  const underOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ customerId, items: [{ productId: product.id, quantity: underQty }] }),
  });
  const underOrder = (await underOrderRes.json()) as { id: string };
  ok("Draft order created (under limit)", underOrderRes.status === 201, underOrderRes.status);

  const underStatusRes = await fetch(`${BASE}/api/orders/${underOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "PENDING" }),
  });
  const underStatusData = (await underStatusRes.json()) as { id: string; status: string };
  ok("DRAFT→PENDING succeeds with 200", underStatusRes.ok, underStatusRes.status);
  ok("Status is PENDING", underStatusData.status === "PENDING", underStatusData.status);
  console.log();

  // ── 7. Outstanding balance counted — second order tips over limit ───────
  console.log("[ Test 7 ] Second order blocked because first PENDING order uses up the limit");
  // underOrder is now PENDING, so outstanding = underQty * price
  // A second order even with qty=1 might still exceed, but let's use a qty that would fit alone
  // but not with the outstanding balance
  const secondQty = underQty; // same amount — outstanding + this = 2x, which exceeds 500
  const secondOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ customerId, items: [{ productId: product.id, quantity: secondQty }] }),
  });
  const secondOrder = (await secondOrderRes.json()) as { id: string };
  ok("Second draft order created", secondOrderRes.status === 201);

  const secondStatusRes = await fetch(`${BASE}/api/orders/${secondOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "PENDING" }),
  });
  const secondStatusData = (await secondStatusRes.json()) as { error?: { code: string } };
  const outstandingTotal = underQty * Number(product.price);
  const secondTotal = secondQty * Number(product.price);
  const wouldExceed = outstandingTotal + secondTotal > 500;
  if (wouldExceed) {
    ok("Second order blocked by outstanding balance", secondStatusRes.status === 422, secondStatusRes.status);
    ok("Error code is CREDIT_LIMIT_EXCEEDED", secondStatusData.error?.code === "CREDIT_LIMIT_EXCEEDED");
  } else {
    console.log(`  (Products too cheap to trigger — outstanding ${outstandingTotal} + ${secondTotal} <= 500, skipping)`);
  }
  console.log();

  // ── 8. creditLimit=0 means unlimited ──────────────────────────────────
  console.log("[ Test 8 ] creditLimit=0 means no limit enforced");
  const unlimitedCustRes = await fetch(`${BASE}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: distCookie },
    body: JSON.stringify({ name: "Unlimited Shop", address: "456 No Limit Rd" }),
  });
  const unlimitedCust = (await unlimitedCustRes.json()) as { id: string; creditLimit: unknown };
  ok("Unlimited customer created with creditLimit=0", Number(unlimitedCust.creditLimit) === 0, unlimitedCust.creditLimit);

  const bigOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ customerId: unlimitedCust.id, items: [{ productId: product.id, quantity: 999 }] }),
  });
  const bigOrder = (await bigOrderRes.json()) as { id: string };
  ok("Large draft order created for unlimited customer", bigOrderRes.status === 201);

  const bigStatusRes = await fetch(`${BASE}/api/orders/${bigOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "PENDING" }),
  });
  ok("DRAFT→PENDING passes with no credit limit", bigStatusRes.ok, bigStatusRes.status);

  // Cancel the big order so stock is not consumed
  await fetch(`${BASE}/api/orders/${bigOrder.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": uuid(), Cookie: salesCookie },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("─".repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
