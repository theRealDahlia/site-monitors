import Image from "next/image";

// Real screenshots of the app, taken from an example agency account with made-up sites (no real customer's information).
// They sit just under the first screen of the home page, so a visitor sees the product before reading about it.

function Shot({ src, width, height, alt, caption, sizes, className = "" }: { src: string; width: number; height: number; alt: string; caption: string; sizes: string; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg shadow-black/5">
        <Image src={src} width={width} height={height} alt={alt} sizes={sizes} className="h-auto w-full" />
      </div>
      <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}

export default function ProductScreenshots() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6" aria-labelledby="screens-heading">
      <h2 id="screens-heading" className="text-2xl font-semibold tracking-tight">
        See Site Monitors in use
      </h2>
      <p className="mt-3 max-w-2xl text-muted">
        Add a site and every check starts straight away. Here is an example account for a small web agency, with made-up sites.
      </p>

      <div className="mt-8 space-y-8">
        <Shot
          src="/screenshots/overview.webp"
          width={1800}
          height={1097}
          sizes="(min-width: 1024px) 960px, 100vw"
          alt="The Overview page of an example account. Nine sites are watched: six are fine, two need a look and one is down. A list shows blog.fabrikam.co is down with an HTTP 503 error, app.tailspin.co has a domain expiring in 18 days and shop.contoso.co has an SSL certificate expiring in 6 days."
          caption="Overview: every site that needs a look, most serious first, with the latest alerts underneath."
        />

        <div className="grid items-start gap-8 md:grid-cols-2">
          <Shot
            src="/screenshots/status-page.webp"
            width={1360}
            height={1470}
            sizes="(min-width: 768px) 464px, 100vw"
            alt="A status page for an example client site, northwind.co. It shows All systems operational, uptime of 100% over 24 hours, 100% over 7 days and 99.93% over 30 days, one bar for each of the last 30 days, and a past outage that was resolved after 29 minutes."
            caption="A status page you can share with a client: current status, uptime for 24 hours, 7 days and 30 days, and any outages."
          />
          <div className="space-y-8">
            <Shot
              src="/screenshots/sites.webp"
              width={1400}
              height={859}
              sizes="(min-width: 768px) 464px, 100vw"
              alt="A table of nine monitors showing each one's uptime, SSL days left, domain days left and AI search result. blog.fabrikam.co is down, and two sites have an SSL certificate or domain expiring soon."
              caption="Sites: uptime, SSL certificate and domain expiry for every site in one list, plus single pages and scheduled jobs."
            />
            <Shot
              src="/screenshots/site-checks.webp"
              width={1400}
              height={589}
              sizes="(min-width: 768px) 464px, 100vw"
              alt="The checks for shop.contoso.co: up with a 233 millisecond response, an SSL certificate with 6 days left, a domain with 301 days left, and readable by AI search."
              caption="One site's checks, with a Check now button to run them again on the spot."
            />
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted">Screenshots show a Pro plan account with example data. AI search checks and some other features are on paid plans, listed under Pricing below.</p>
    </section>
  );
}
