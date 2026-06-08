// Per-seller commission schedule over 4 years, measured from EACH customer's signup date
// (each referred customer has their own 4-year clock).
// Year 1 -> rate_y1, year 2 -> rate_y2, year 3 -> rate_y3, year 4 and forever -> rate_y4.

export interface RateSchedule {
  rate_y1: number | string;
  rate_y2: number | string;
  rate_y3: number | string;
  rate_y4: number | string;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Which year-bucket (0..3) a date falls into, relative to the customer's signup.
export function yearIndex(customerStartISO: string, atISO: string): number {
  const start = new Date(customerStartISO).getTime();
  const at = new Date(atISO).getTime();
  if (!isFinite(start) || !isFinite(at)) return 0;
  const years = (at - start) / MS_PER_YEAR;
  return Math.min(Math.max(Math.floor(years), 0), 3);
}

// Commission rate (decimal, e.g. 0.25) for a payment made on `atISO` by a customer who
// signed up on `customerStartISO`.
export function rateForPayment(schedule: RateSchedule, customerStartISO: string, atISO: string): number {
  const rates = [schedule.rate_y1, schedule.rate_y2, schedule.rate_y3, schedule.rate_y4].map(Number);
  return rates[yearIndex(customerStartISO, atISO)];
}

// ---------- Multi-level override hierarchy ----------
// Each partner earns their own tiered rate on their own customers. Each ancestor (manager)
// earns the DIFFERENCE between their flat manager_rate and the rate of the partner directly
// below them in the chain (clamped to >= 0). Total payout on a sale = the top manager's rate.

export interface Partner extends RateSchedule {
  id: string;
  ref_code: string;
  parent_id: string | null;
  manager_rate: number | string | null;
}
export interface PaymentRow { user_id: string; amount: number | string; created_at: string; }
export interface Shares {
  own: number;          // commission on the partner's own direct customers
  override: number;     // override earned from the partner's downline
  grossOwn: number;     // gross paid by the partner's own direct customers
  ownPayers: Set<string>;
  overrideByChild: Map<string, number>; // child partner id -> override amount earned via that child
}

function blankShares(): Shares {
  return { own: 0, override: 0, grossOwn: 0, ownPayers: new Set(), overrideByChild: new Map() };
}

// Depth in the hierarchy (top-level partner = 1). Capped walk for safety.
export function depthOf(id: string, parentMap: Map<string, string | null>): number {
  let depth = 1;
  let cur = parentMap.get(id) ?? null;
  let guard = 0;
  while (cur && guard < 30) {
    depth++;
    cur = parentMap.get(cur) ?? null;
    guard++;
  }
  return depth;
}

// Max recruitment depth: salgssjef (1) -> selger (2) -> selger (3). No deeper.
export const MAX_DEPTH = 3;

// Compute every partner's own + override commission for a set of payments.
export function computeAllShares(
  partners: Partner[],
  custToRef: Map<string, string>,   // customer user_id -> seller_ref
  signup: Map<string, string>,      // customer user_id -> signup ISO date
  payments: PaymentRow[],
): Map<string, Shares> {
  const byId = new Map(partners.map(p => [p.id, p]));
  const byRef = new Map(partners.map(p => [String(p.ref_code).toLowerCase(), p]));
  const acc = new Map<string, Shares>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = blankShares(); acc.set(id, a); }
    return a;
  };

  for (const pay of payments) {
    const ref = custToRef.get(pay.user_id);
    if (!ref) continue;
    const seller = byRef.get(String(ref).toLowerCase());
    if (!seller) continue;

    const amount = Number(pay.amount);
    const start = signup.get(pay.user_id) ?? '';
    // A manager earns their flat manager_rate on their OWN sales (forever). A regular
    // seller earns their per-customer 4-year tiered rate.
    const r0 = seller.manager_rate != null
      ? Number(seller.manager_rate)
      : (start ? rateForPayment(seller, start, pay.created_at) : Number(seller.rate_y1));

    const aS = get(seller.id);
    aS.grossOwn += amount;
    aS.own += amount * r0;
    aS.ownPayers.add(pay.user_id);

    // Walk up the chain, paying each ancestor their differential.
    let belowRate = r0;
    let childId = seller.id;
    let node = seller.parent_id ? byId.get(seller.parent_id) : undefined;
    const seen = new Set<string>([seller.id]);
    let depth = 0;
    while (node && depth < 20 && !seen.has(node.id)) {
      seen.add(node.id);
      const m = Number(node.manager_rate ?? 0);
      const diff = Math.max(0, m - belowRate);
      if (diff > 0) {
        const aN = get(node.id);
        aN.override += amount * diff;
        aN.overrideByChild.set(childId, (aN.overrideByChild.get(childId) ?? 0) + amount * diff);
      }
      belowRate = m;
      childId = node.id;
      node = node.parent_id ? byId.get(node.parent_id) : undefined;
      depth++;
    }
  }
  return acc;
}
