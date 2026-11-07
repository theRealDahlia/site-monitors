import type { Metadata } from "next";
import PlanComparison from "@/components/PlanComparison";
import Plans from "@/components/Plans";

export const metadata: Metadata = {
  title: "Plans",
  robots: { index: false },
};

export default function PlansPage() {
  return (
    <Plans>
      <section aria-labelledby="compare-heading" className="mt-10">
        <h2 id="compare-heading" className="font-semibold">
          Compare plans
        </h2>
        {/* Below 1024px the app has a bar fixed to the top of the screen, about 65px tall. */}
        <PlanComparison className="mt-3" stickyTop="top-[65px] lg:top-0" />
      </section>
    </Plans>
  );
}
