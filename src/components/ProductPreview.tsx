// Three small pictures of the product on the home page, drawn from sample data (no real customer's information).
// They're ordinary page elements, not images, so they stay sharp on any screen and follow light and dark mode.

const BARS = [100, 100, 100, 100, 99, 100, 100, 100, 100, 100, 100, 97, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
const bar = (v: number) => (v >= 99.9 ? "bg-ok" : v >= 95 ? "bg-warn" : "bg-bad");

function Frame({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col">
      <div aria-hidden className="flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg shadow-black/5">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="h-2 w-2 rounded-full bg-border" />
          <span className="ml-2 truncate text-[11px] text-muted">{title}</span>
        </div>
        <div className="p-4">{children}</div>
      </div>
      <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}

const Dot = ({ tone }: { tone: "ok" | "warn" | "bad" }) => <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${{ ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone]}`} />;

function SitesList() {
  const rows: { host: string; tone: "ok" | "warn" | "bad"; up: string; ssl: string; sslTone: string }[] = [
    { host: "northwind.co", tone: "ok", up: "Up", ssl: "62 days", sslTone: "text-ok" },
    { host: "shop.contoso.co", tone: "warn", up: "Up", ssl: "6 days", sslTone: "text-warn" },
    { host: "blog.fabrikam.co", tone: "bad", up: "Down", ssl: "41 days", sslTone: "text-ok" },
    { host: "app.tailspin.co", tone: "ok", up: "Up", ssl: "29 days", sslTone: "text-ok" },
    { host: "wingtip.co", tone: "ok", up: "Up", ssl: "75 days", sslTone: "text-ok" },
  ];
  return (
    <div className="text-xs">
      <div className="grid grid-cols-[1.7fr_0.7fr_1fr] gap-2 pb-2 text-[10px] font-medium text-muted">
        <span>Monitor</span>
        <span>Uptime</span>
        <span>SSL</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.host} className="grid grid-cols-[1.7fr_0.7fr_1fr] items-center gap-2 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <Dot tone={r.tone} />
              <span className="truncate font-medium">{r.host}</span>
            </span>
            <span className={r.tone === "bad" ? "font-medium text-bad" : "text-ok"}>{r.up}</span>
            <span className={r.sslTone}>{r.ssl}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPage() {
  return (
    <div>
      <p className="text-sm font-semibold">Northwind Traders</p>
      <p className="text-[10px] text-muted">Status page</p>
      <div className="mt-3 rounded-lg bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">All systems operational</div>
      <ul className="mt-3 space-y-2.5">
        {["northwind.example", "shop.northwind.example"].map((host, i) => (
          <li key={host} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{host}</span>
              <span className="flex items-center gap-1.5 text-muted">
                <Dot tone="ok" />
                Operational
              </span>
            </div>
            <div className="mt-2 flex gap-[2px]">
              {BARS.map((v, n) => (
                <span key={n} className={`h-4 flex-1 rounded-[2px] ${bar(i === 0 ? v : 100)}`} />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted">{i === 0 ? "99.9" : "100"}% over 30 days</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertEmail() {
  return (
    <div className="text-xs">
      <p className="text-[10px] text-muted">From: Site Monitors · To: you@youragency.example</p>
      <p className="mt-2 text-sm font-semibold">The SSL certificate for shop.contoso.example expires in 7 days</p>
      <div className="mt-3 space-y-2 leading-relaxed text-muted">
        <p>The SSL certificate for shop.contoso.example expires on November 2, 2026, in 7 days.</p>
        <p>Issuer: Let&apos;s Encrypt</p>
        <p>Renew it before then to avoid a security warning for visitors.</p>
        <p className="text-accent underline underline-offset-2">See all your monitors</p>
      </div>
    </div>
  );
}

/** "What it looks like": the Sites list, a client's status page and an alert email. */
export default function ProductPreview() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6" aria-labelledby="preview-heading">
      <h2 id="preview-heading" className="text-2xl font-semibold tracking-tight">
        See every client site at a glance
      </h2>
      <p className="mt-2 max-w-2xl text-muted">Sample data. Your own sites appear the moment you add them.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Frame title="Sites" caption="Every site's uptime, certificate and domain in one list, so the one that needs a look stands out.">
          <SitesList />
        </Frame>
        <Frame title="status.northwind.example" caption="A status page for each client, with their logo and colours, on their own domain.">
          <StatusPage />
        </Frame>
        <Frame title="Inbox" caption="An email with the details and what to do, days before a visitor would see a warning.">
          <AlertEmail />
        </Frame>
      </div>
    </section>
  );
}
