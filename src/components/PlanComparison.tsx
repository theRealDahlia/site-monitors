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

const GROUP_BG = "bg-[color-mix(in_srgb,var(--surface),var(--foreground)_5%)]";

/**
 * What each plan includes, side by side, in groups. Used on the pricing page and the in-app Plans page.
 * `stickyTop` is where the phone layout's plan names stay pinned while scrolling: a Tailwind `top-*` class, for pages
 * that have their own bar fixed to the top of the screen.
 */
export default function PlanComparison({ className = "", stickyTop = "top-0" }: { className?: string; stickyTop?: string }) {
  return (
    <div className={className}>
      <Table />
      <Stacked stickyTop={stickyTop} />
    </div>
  );
}

/**
 * Narrow screens (under 768px): the table needs about 680px, so there every feature gets its name on a line of its own
 * with all four plans' answers in a row beneath it, and the plan names stay pinned above. No sideways scrolling, and
 * every plan is in view at once.
 */
function Stacked({ stickyTop }: { stickyTop: string }) {
  return (
    <div className="md:hidden">
      {/* Each value below has the plan's name for screen readers, so this strip is for sighted use only. */}
      <div aria-hidden className={`sticky ${stickyTop} z-20 grid grid-cols-4 rounded-t-xl border border-b-0 border-border bg-surface px-4 py-3 text-center`}>
        {PLANS.map((p) => (
          <div key={p.name}>
            <span className="block text-sm font-semibold">{p.name}</span>
            <span className="block text-xs text-muted">${p.price}/mo</span>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-b-xl border border-t-0 border-border bg-surface">
        {COMPARISON.map((g) => (
          <section key={g.group}>
            <h3 className={`border-t border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${GROUP_BG}`}>{g.group}</h3>
            <ul>
              {g.rows.map((row) => (
                <li key={row.feature} className="border-t border-border px-4 py-3 first:border-t-0">
                  <p className="text-sm">{row.feature}</p>
                  <ul className="mt-2 grid grid-cols-4 text-center text-sm">
                    {row.values.map((v, i) => (
                      <li key={PLANS[i].name} className="flex items-center justify-center">
                        <span className="sr-only">{PLANS[i].name}: </span>
                        <Cell value={v} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** From 768px up: one table with a column for each plan. */
function Table() {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
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
            {/* The group's name sits in the first column, which stays put when the table scrolls sideways. A cell that spanned
                the whole table couldn't: it has no room to move. The tint is mixed to be opaque so scrolled cells don't show through. */}
            <tr className="border-b border-t border-border first:border-t-0">
              <th scope="rowgroup" className={`sticky left-0 z-10 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-5 ${GROUP_BG}`}>
                {g.group}
              </th>
              <td colSpan={PLANS.length} className={GROUP_BG} />
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
