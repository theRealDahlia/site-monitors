import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Section } from "@/components/LegalPage";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules for using ${BRAND}: accounts, acceptable use, paid plans, cancelling and what we do and don't promise.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms are the agreement between you and ${BRAND} when you use the website and service. By creating an account or using the service you agree to them. If you don't agree, please don't use it.`}
    >
      <Section heading="The service">
        <p>
          {BRAND} checks websites you tell us about, such as whether they&apos;re up and when their SSL certificates and domains expire, and sends alerts, reports and status pages. What each plan includes
          is listed on the <Link href="/pricing">pricing page</Link>. We may improve, change or remove features over time, and we&apos;ll give notice before removing anything a paid plan relies on.
        </p>
      </Section>

      <Section heading="Your account">
        <ul>
          <li>You must be at least 18 and able to enter a contract, and give us a working email address.</li>
          <li>Keep your password and API keys secret. You&apos;re responsible for what happens under your account, including by team members you invite.</li>
          <li>Tell us right away if you think someone else has got into your account.</li>
        </ul>
      </Section>

      <Section heading="Acceptable use">
        <p>You agree to use the service lawfully and fairly. In particular, you won&apos;t:</p>
        <ul>
          <li>Monitor or scan sites you don&apos;t own and aren&apos;t authorised to monitor.</li>
          <li>Use the service to attack, overload or probe anyone&apos;s systems, or to send spam or abusive messages.</li>
          <li>Try to get around plan limits, rate limits or security, or interfere with how the service works.</li>
          <li>Upload or publish anything unlawful, misleading or that infringes someone else&apos;s rights, including on a status page.</li>
          <li>Resell the service or its data to others, except as a plan such as Pro or Agency allows (for example, status pages and reports for your own clients).</li>
        </ul>
        <p>We may limit or suspend an account that breaks these rules or puts the service or other people at risk.</p>
      </Section>

      <Section heading="Paid plans and billing">
        <ul>
          <li>Paid plans are monthly subscriptions, charged in US dollars to your card through Stripe. The price is the one shown when you subscribe.</li>
          <li>Your subscription renews automatically each month until you cancel. You&apos;re charged at the start of each billing period.</li>
          <li>
            You can change plan, update your card, view invoices or cancel at any time from Manage billing on the Plans page. Cancelling stops future charges, and your plan stays active until the
            end of the period you&apos;ve paid for, then your account moves to Free.
          </li>
          <li>Payments are non-refundable, including for part of a month, unless the law says otherwise or we decide to make an exception. If something went wrong, write to us.</li>
          <li>If you change plan part-way through a period, Stripe adjusts the charge for the time left.</li>
          <li>If a payment fails we&apos;ll retry it, and your plan may move to Free if it can&apos;t be collected.</li>
          <li>We may change prices. We&apos;ll tell you at least 30 days before a new price applies to you, and you can cancel before it does.</li>
          <li>If you move to a smaller plan, we keep your sites and settings, but you may be unable to add more or use features the new plan doesn&apos;t include until you&apos;re within its limits.</li>
        </ul>
      </Section>

      <Section heading="Monitoring isn't a guarantee">
        <p>
          We work to run checks and send alerts reliably, but we can&apos;t promise every outage, expiry or change will be detected or that every alert will arrive on time. Emails, Slack and Discord can be
          delayed or filtered by services we don&apos;t control. Don&apos;t rely on {BRAND} as your only safeguard for anything critical. We don&apos;t promise the service will be always available or free of errors.
        </p>
      </Section>

      <Section heading="Your content and data">
        <p>
          You keep ownership of what you give us: your sites&apos; details, logos, status page text and so on. You allow us to store and use it only to run the service for you, as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. You promise you have the right to add it, including any email addresses of other people.
        </p>
        <p>The service, its design and its code belong to us. These terms give you the right to use the service, not to copy it or take it apart.</p>
      </Section>

      <Section heading="Ending things">
        <p>
          You can stop using {BRAND} and close your account at any time (email us if you need help). We can suspend or close an account that breaks these terms, or that has been inactive for a long
          time on the Free plan, and we&apos;ll give you notice where we reasonably can. After an account closes, your data is deleted as described in the Privacy Policy.
        </p>
      </Section>

      <Section heading="Our responsibility">
        <p>
          The service is provided &ldquo;as is&rdquo;, without promises about it being error-free or meeting your particular needs, to the extent the law allows. To the extent the law allows, we aren&apos;t
          liable for indirect or consequential losses, such as lost profits, lost business or lost data, or for losses caused by something outside our control. Our total liability to you for anything arising from the
          service is limited to the amount you paid us in the 12 months before the problem arose. Nothing in these terms limits liability that can&apos;t be limited by law.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          We may update these terms. If a change matters, we&apos;ll update the date at the top and email account holders at least 14 days beforehand where we can. Continuing to use the service after a
          change means you accept it.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
