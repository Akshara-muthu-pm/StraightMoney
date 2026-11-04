import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState, parseDemoState, toggleFollow, addReceipt, demoRoles } from "../lib/demo-state.ts";
import { invoiceStages, totalFunded } from "../lib/presentation.ts";
import { budgetSummary } from "../lib/budget.ts";
import { campaignImagery } from "../lib/campaign-imagery.ts";
import { impactShapes, interpolatePoints, shapePath } from "../lib/impact-motion.ts";
import { releaseFrames, springResponse, tapFeedbackFrames } from "../lib/spring-motion.ts";

test("a quick click completes a visible press before its spring release", () => {
  const frames = tapFeedbackFrames(0.999);
  assert.equal(Number(frames[0].scale), 0.999);
  assert.equal(Number(frames[1].scale), 0.95);
  assert.equal(Number(frames.at(-1).scale), 1);
  assert.ok(frames.some((frame) => Number(frame.scale) > 1));
  assert.ok(frames.every((frame, index) => index === 0 || frame.offset > frames[index - 1].offset));
});

test("press release overshoots gently and settles at the original size", () => {
  const frames = releaseFrames();
  const scales = frames.map((frame) => Number(frame.scale));
  assert.equal(scales[0], 0.95);
  assert.equal(scales.at(-1), 1);
  assert.ok(Math.max(...scales) > 1 && Math.max(...scales) < 1.04);
  assert.ok(scales.every((scale) => Number.isFinite(scale) && scale >= 0.94));
  assert.equal(releaseFrames(0.98)[0].scale, "0.98");
  assert.ok(frames.every((frame, index) => index === 0 || frame.offset > frames[index - 1].offset));
});
test("spring-based vector transitions remain finite and reach the selected shape", () => {
  assert.equal(springResponse(0), 0);
  assert.equal(springResponse(1), 1);
  for (const target of impactShapes) {
    for (let step = 0; step <= 100; step++) {
      const points = interpolatePoints(impactShapes[0], target, springResponse(step / 100), false);
      assert.ok(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < 100 && y > 0 && y < 100));
      if (step === 100) assert.deepEqual(points, target);
    }
  }
});

test("vector morphs preserve endpoints and clamp interpolation", () => {
  for (let index = 0; index < impactShapes.length; index++) {
    const from = impactShapes[index];
    const to = impactShapes[(index + 1) % impactShapes.length];
    assert.equal(from.length, to.length);
    assert.deepEqual(interpolatePoints(from, to, -1), from);
    assert.deepEqual(interpolatePoints(from, to, 2), to);
    const middle = interpolatePoints(from, to, 0.5);
    middle.forEach(([x, y], point) => {
      assert.equal(x, (from[point][0] + to[point][0]) / 2);
      assert.equal(y, (from[point][1] + to[point][1]) / 2);
    });
  }
});
test("every morph state produces a finite closed vector with matching topology", () => {
  for (const target of impactShapes) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const path = shapePath(interpolatePoints(impactShapes[0], target, progress));
      assert.ok(path.startsWith("M ") && path.endsWith(" Z"));
      assert.equal((path.match(/ C /g) ?? []).length, 12);
      assert.ok(!/NaN|Infinity|undefined/.test(path));
    }
  }
});

test("library imagery stays with library campaigns", () => {
  assert.equal(campaignImagery("School Library Corner").src, "/images/library.jpg");
  assert.equal(campaignImagery("School Library Corner", "detail").src, "/images/campaign-books.jpg");
  assert.notEqual(campaignImagery("Community food drive").src, "/images/library.jpg");
});

const invoice = { status: "AWAITING_VERIFIER", verifications: [], paid_amount: 0, remaining_amount: 400 };
const donation = { id: 1, campaign_id: 1, donor_name: "Test donor", amount: 25, currency: "USD", paypal_order_id: "TEST-ORDER", status: "captured", created_at: "2026-11-02T00:00:00Z" };

test("all four roles have separate dashboard destinations", () => {
  assert.equal(new Set(demoRoles.map((role) => role.path)).size, 4);
  assert.equal(demoRoles.find((role) => role.name === "Donor").path, "/donor");
});
test("funding does not go backwards after a confirmed vendor payout", () => {
  assert.equal(totalFunded({ pool_balance: 800, budget_lines: [{ paid_amount: 400 }] }), 1200);
});
test("approval and payment remain separate through the payout lifecycle", () => {
  for (const [status, expected] of [["AWAITING_FUNDS", "Awaiting funds"], ["PAYOUT_PENDING", "Awaiting PayPal confirmation"], ["FAILED", "Payment failed"]]) {
    assert.deepEqual(invoiceStages({ ...invoice, status }), { review: "Approved", payment: expected });
  }
  assert.deepEqual(invoiceStages(invoice), { review: "Awaiting review", payment: "Not paid" });
  assert.deepEqual(invoiceStages({ ...invoice, status: "PAID", paid_amount: 400 }), { review: "Approved", payment: "Paid" });
});
test("a partial payment or sandbox override cannot look fully paid", () => {
  assert.deepEqual(invoiceStages({ ...invoice, status: "PARTIALLY_PAID", paid_amount: 100 }), { review: "Approved", payment: "Partially paid" });
  assert.deepEqual(invoiceStages({ ...invoice, verifications: [{ decision: "test_override" }], status: "FAILED" }), { review: "Sandbox override", payment: "Payment failed" });
});
test("rejected invoices do not appear approved", () => {
  assert.deepEqual(invoiceStages({ ...invoice, status: "REJECTED" }), { review: "Policy rejected", payment: "Not paid" });
  assert.deepEqual(invoiceStages({ ...invoice, status: "VERIFIER_REJECTED" }), { review: "Verifier rejected", payment: "Not paid" });
});
test("budget separates approved commitments from confirmed payouts", () => {
  const line = { id: 1, budgeted_amount: 600, paid_amount: 100 };
  const invoices = [
    { id: 1, budget_line_id: 1, status: "PARTIALLY_PAID", amount: 400, paid_amount: 100, verifications: [] },
    { id: 2, budget_line_id: 1, status: "REJECTED", amount: 120, paid_amount: 0, verifications: [] },
    { id: 3, budget_line_id: 2, status: "VERIFIER_APPROVED", amount: 50, paid_amount: 0, verifications: [] },
  ];
  const summary = budgetSummary(line, invoices);
  assert.equal(summary.planned, 600);
  assert.equal(summary.approvedUnpaid, 300);
  assert.equal(summary.paid, 100);
  assert.equal(summary.remaining, 200);
  assert.equal(summary.approvedCount, 1);
  assert.equal(summary.invoices.length, 2);
});
test("following toggles without duplicates or changes to other projects", () => {
  const state = toggleFollow(toggleFollow(createDemoState("Donor", "Test"), 1), 2);
  assert.deepEqual(toggleFollow(state, 1).followed, [2]);
  assert.deepEqual(state.followed, [1, 2]);
});
test("only captured donations enter a donor history and captures are deduplicated", () => {
  const initial = createDemoState("Donor", "Test");
  assert.equal(addReceipt(initial, { ...donation, status: "created" }, "Library", "sandbox").receipts.length, 0);
  const recorded = addReceipt(initial, donation, "Library", "simulated");
  assert.equal(recorded.receipts[0].mode, "simulated");
  assert.equal(addReceipt(recorded, donation, "Library", "simulated").receipts.length, 1);
  assert.equal(addReceipt(createDemoState("Vendor", "Test"), donation, "Library", "sandbox").receipts.length, 0);
});
test("fresh sessions start empty and stored role state is validated", () => {
  const state = createDemoState("Donor", "  Alex  ");
  assert.equal(state.name, "Alex");
  assert.deepEqual(state.receipts, []);
  assert.deepEqual(parseDemoState(JSON.stringify(state)), state);
  for (const raw of ["broken json", "null", JSON.stringify({ ...state, role: "Admin" }), JSON.stringify({ ...state, followed: ["bad"] }), JSON.stringify({ ...state, receipts: [{}] })]) {
    assert.equal(parseDemoState(raw), null);
  }
});
