import { Inline } from "@/components/Prose";

export interface FaqItem {
  q: string;
  /** Plain text, with the same [link](/path), `code` and **bold** formatting guides use. */
  a: string;
}

/**
 * Questions and answers that expand when opened. The answers are in the page's HTML even while
 * closed, so search engines and screen readers see all of them.
 */
export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
            {item.q}
            <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-6 text-muted">
            <Inline text={item.a} />
          </p>
        </details>
      ))}
    </div>
  );
}
