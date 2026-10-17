import { COMPARISON, PLANS } from "@/lib/plans";

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <span aria-label="Included" className="text-ok">✓</span>;
  if (value === false) return <span aria-label="Not included" className="text-muted">—</span>;
  return <span>{value}</span>;
}

/** What each plan includes, side by side. Used on the pricing page and the in-app Plans page. */
export default function PlanComparison({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border ${className}`}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">What each plan includes</caption>
        <thead>
          <tr className="border-b border-border bg-surface">
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Feature</span>
            </th>
            {PLANS.map((p) => (
              <th key={p.name} scope="col" className="px-4 py-3 font-semibold">
                {p.name}
                {!p.available && <span className="ml-1.5 text-xs font-normal text-muted">(planned)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.feature} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-3 font-normal text-muted">
                {row.feature}
              </th>
              {row.values.map((v, i) => (
                <td key={PLANS[i].name} className="px-4 py-3">
                  <Cell value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
