import { Footer, Header } from "@/components/SiteChrome";
import { LEGAL_UPDATED } from "@/lib/brand";

/** The shell for the privacy policy and terms: the site's header and footer around plain, readable text. */
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-6 text-lg text-muted">{intro}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}

/** One numbered-free section: a heading and its paragraphs and lists. */
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
