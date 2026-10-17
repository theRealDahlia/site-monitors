import type { Metadata } from "next";
import Link from "next/link";
import AlertsCta from "@/components/AlertsCta";
import { Blocks } from "@/components/Prose";
import SignedInRedirect from "@/components/SignedInRedirect";
import { Footer, Header } from "@/components/SiteChrome";
import { BRAND } from "@/lib/brand";
import { GUIDES, type Guide, type Mode, getGuide } from "@/lib/guides";
import { SITE_URL } from "@/lib/site-url";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-16" as "October 16, 2026". Done by hand so it never depends on the visitor's or the server's time zone. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Where the guides live: for visitors, and inside the app for logged-in users. */
const BASE: Record<Mode, string> = { public: "/guides", app: "/dashboard/guides" };

/** The public page's title, description and share tags. Each guide's page file calls this once. */
export function guideMetadata(slug: string): Metadata {
  const g = getGuide(slug);
  const path = `/guides/${g.slug}`;
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: path },
    // A page that sets its own social tags replaces the site-wide ones, image included, so they're all repeated here.
    openGraph: {
      type: "article",
      title: g.title,
      description: g.description,
      url: path,
      modifiedTime: g.updated,
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: `${BRAND}: ${g.title}` }],
    },
    twitter: { card: "summary_large_image", title: g.title, description: g.description, images: ["/opengraph-image.png"] },
  };
}

/** The in-app copy of a guide stays out of search results; the public copy is the one to find. */
export function appGuideMetadata(slug: string): Metadata {
  const g = getGuide(slug);
  return { title: g.title, robots: { index: false } };
}

/** The title, the text and the related guides. Identical in both places apart from wording and links. */
function GuideBody({ guide: g, mode }: { guide: Guide; mode: Mode }) {
  const related = g.related.map((s) => GUIDES.find((x) => x.slug === s)).filter((x) => x !== undefined);
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={BASE[mode]} className="hover:text-foreground">
          Guides
        </Link>
      </nav>
      <article>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{g.title}</h1>
        <p className="mt-3 text-sm text-muted">
          Updated {prettyDate(g.updated)} · {g.minutes} min read
        </p>
        <Blocks blocks={g.blocks} mode={mode} />
      </article>

      {mode === "app" ? (
        <section className="mt-16 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">Watching everything you should be?</h2>
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
            We check every site you add around the clock, and email you before a certificate or domain expires.
          </p>
          <Link
            href="/dashboard/sites"
            className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Add a site
          </Link>
        </section>
      ) : (
        <section className="mt-16 rounded-xl border border-border bg-surface p-6">
          <AlertsCta
            heading="Get alerted before it expires"
            body="Create a free account and we'll watch your certificates and domains for you, and email you before anything expires. Free for up to 5 sites."
          />
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-lg font-semibold tracking-tight">
            Related guides
          </h2>
          <ul className="mt-4 space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`${BASE[mode]}/${r.slug}`} className="font-medium text-accent underline underline-offset-2 hover:opacity-80">
                  {r.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted">{r.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The public page, for visitors and search engines. */
export function GuideArticle({ slug }: { slug: string }) {
  const g = getGuide(slug);

  // Structured data that tells search engines what this page is. `<` is escaped so the text can never close the script tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    dateModified: g.updated,
    mainEntityOfPage: `${SITE_URL}/guides/${g.slug}`,
    author: { "@type": "Organization", name: BRAND, url: SITE_URL },
    publisher: { "@type": "Organization", name: BRAND, url: SITE_URL },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <Header />
      {/* Logged-in people read guides inside the app. The proxy sends them before the page loads; this covers the Back button. */}
      <SignedInRedirect to={`/dashboard/guides/${g.slug}`} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <GuideBody guide={g} mode="public" />
      </main>
      <Footer />
    </>
  );
}

/** The same guide inside the app, under the left menu. The app's own layout supplies the menu. */
export function AppGuideArticle({ slug }: { slug: string }) {
  return (
    <div className="max-w-3xl">
      <GuideBody guide={getGuide(slug)} mode="app" />
    </div>
  );
}

/** The list of guides, linking to the public pages or the in-app ones. */
export function GuideCards({ mode }: { mode: Mode }) {
  return (
    <ul className="space-y-4">
      {GUIDES.map((g) => (
        <li key={g.slug}>
          <Link href={`${BASE[mode]}/${g.slug}`} className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent">
            <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{g.description}</p>
            <p className="mt-3 text-xs text-muted">
              Updated {prettyDate(g.updated)} · {g.minutes} min read
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
