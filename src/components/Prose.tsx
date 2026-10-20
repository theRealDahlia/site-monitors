import Link from "next/link";
import { type Block, type Mode, forMode } from "@/lib/guides";

const LINK = "text-accent underline underline-offset-2 hover:opacity-80";

/**
 * Where a guide link should go inside the app. Guides live under /dashboard/guides there, and the
 * sign-up page has no use for someone who's already signed in, so it points at the Sites page instead.
 * (Links to the public checkers aren't written for the app version at all; see forMode in guides.ts.)
 */
function appHref(href: string): string {
  if (href === "/guides" || href.startsWith("/guides/")) return `/dashboard${href}`;
  if (href === "/signup") return "/dashboard/sites";
  return href;
}

/** Renders the small inline formatting guides use: [text](address), `code` and **bold**. */
export function Inline({ text, mode = "public" }: { text: string; mode?: Mode }) {
  const parts = forMode(text, mode).split(/(\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const [, label, rawHref] = link;
          const href = mode === "app" ? appHref(rawHref) : rawHref;
          if (href.startsWith("/")) {
            return (
              <Link key={i} href={href} className={LINK}>
                {label}
              </Link>
            );
          }
          if (href.startsWith("https://")) {
            return (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
                {label}
              </a>
            );
          }
          return label; // Anything else isn't a link we'd ever write, so show just its words.
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </>
  );
}

export function Blocks({ blocks, mode = "public" }: { blocks: Block[]; mode?: Mode }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="mt-12 text-2xl font-semibold tracking-tight text-foreground">
                {forMode(b.text, mode)}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="mt-4 leading-7 text-muted">
                <Inline text={b.text} mode={mode} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.type === "ul" ? "ul" : "ol";
            return (
              <List key={i} className={`mt-4 space-y-3 pl-6 leading-7 text-muted ${b.type === "ul" ? "list-disc" : "list-decimal"} marker:text-accent`}>
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Inline text={item} mode={mode} />
                  </li>
                ))}
              </List>
            );
          }
          case "code":
            return (
              <pre key={i} className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-6 text-foreground">
                <code>{b.text}</code>
              </pre>
            );
          case "note":
            return (
              <aside key={i} className="mt-6 rounded-xl border border-border bg-surface p-5">
                <p className="font-semibold text-foreground">{forMode(b.title, mode)}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  <Inline text={b.text} mode={mode} />
                </p>
              </aside>
            );
        }
      })}
    </>
  );
}
