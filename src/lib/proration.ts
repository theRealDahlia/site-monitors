const DAY_SECONDS = 86_400;

/**
 * What someone is owed back for the unused part of what they paid for a billing period.
 *
 * The period is counted in whole days. The daily cost is what they paid divided by the days in the period, and the refund
 * is that daily cost for each day still to come. A day that has already started counts as used, so only whole days left
 * are refunded. The refund is rounded down to a cent, so it can never be more than the person paid.
 *
 * Example: paid $29.00 for a 10-day period, 5 days in: 5 whole days left, so $14.50 comes back.
 */
export function unusedRefund(paidCents: number, periodStart: number, periodEnd: number, now: number): { daysTotal: number; daysRemaining: number; refundCents: number } {
  const daysTotal = Math.max(1, Math.round((periodEnd - periodStart) / DAY_SECONDS));
  const daysRemaining = Math.min(daysTotal, Math.max(0, Math.floor((periodEnd - now) / DAY_SECONDS)));
  const refundCents = Math.max(0, Math.floor((paidCents * daysRemaining) / daysTotal));
  return { daysTotal, daysRemaining, refundCents };
}
