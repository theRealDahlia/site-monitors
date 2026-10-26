import { COMPARISON, PLANS } from "@/lib/plans";

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span aria-label="Included" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ok-bg text-xs font-semibold text-ok">
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span aria-label="Not included" className="text-muted/50">
        —
      </span>
    );
  }
  return <span className="font-medium">{value}</span>;
}

/** What each plan includes, side by side, in groups. Used on the pricing page and the in-app Plans page. */
export default function PlanComparison({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border bg-surface ${className}`}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">What each plan includes</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-10 w-[34%] bg-surface px-4 py-4 sm:px-5">
              <span className="sr-only">Feature</span>
            </th>
            {PLANS.map((p) => (
              <th key={p.name} scope="col" className="px-3 py-4 text-center align-bottom">
                <span className="block text-base font-semibold">{p.name}</span>
                <span className="block text-xs font-normal text-muted">${p.price}/month</span>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map((g) => (
          <tbody key={g.group}>
            <tr>
              <th scope="colgroup" colSpan={PLANS.length + 1} className="sticky left-0 border-b border-t border-border bg-foreground/5 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted first:border-t-0 sm:px-5">
                {g.group}
              </th>
            </tr>
            {g.rows.map((row) => (
              <tr key={row.feature} className="border-b border-border last:border-b-0 hover:bg-foreground/[0.03]">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-normal sm:px-5">
                  {row.feature}
                </th>
                {row.values.map((v, i) => (
                  <td key={PLANS[i].name} className="px-3 py-3 text-center">
                    <Cell value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
