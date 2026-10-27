import type { Metadata } from "next";
import LegalPage, { Section } from "@/components/LegalPage";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${BRAND} collects, why, who it's shared with, and how to ask us to change or delete it.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${BRAND} watches websites and emails people when something needs attention. This page explains what we collect to do that, what we do with it, and the choices you have. We keep it short on purpose.`}
    >
      <Section heading="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> your email address and a password. We only store a scrambled (hashed) version of the password, so we can&apos;t read it.
          </li>
          <li>
            <strong>The sites you monitor:</strong> the addresses you add, your settings for them, and the results of our checks: whether a site was up, how fast it
            answered, SSL certificate and domain expiry dates, and the results of the health scan and other checks your plan includes.
          </li>
          <li>
            <strong>Other people&apos;s email addresses you give us:</strong> people you add to receive alerts or reports, team members you invite, and visitors who
            subscribe to a status page. We use them only to send what they signed up for or were added to receive.
          </li>
          <li>
            <strong>Things you add to your account:</strong> a logo and brand colours, status page updates you write, API keys (stored hashed), and Slack or Discord connections.
            The tokens that let us post to Slack or Discord are stored encrypted. On plans with clients, this includes your clients&apos; names, logos and brand colours, and the sites you group under them.
          </li>
          <li>
            <strong>Messages you send us:</strong> what you write in the contact form, with the email address on your account so we can reply.
          </li>
          <li>
            <strong>Payment details:</strong> if you buy a paid plan, Stripe collects your card details. We never see or store your card number. We keep your Stripe customer and
            subscription IDs and which plan you&apos;re on.
          </li>
          <li>
            <strong>Technical information:</strong> your IP address and the time of requests, used to limit abuse and keep the service running, and the sign-in cookie
            described below. If you use the free SSL or domain checkers without an account, we see the address you check and your IP address, which is how we apply the daily limit.
            When something breaks, we may receive a short technical report, such as the error, the page it happened on and the type of browser, so we can fix it.
          </li>
        </ul>
      </Section>

      <Section heading="How we use it">
        <ul>
          <li>To run the service: check your sites, show you the results, and send alerts, reports and status page updates.</li>
          <li>To take payment and keep your plan in line with your subscription.</li>
          <li>To send emails about your account, such as sign-up codes, password resets, invitations and billing notices.</li>
          <li>To keep the service secure and stop abuse, and to fix problems.</li>
        </ul>
        <p>We don&apos;t sell your information, and we don&apos;t use it for advertising. We don&apos;t send marketing emails you didn&apos;t ask for.</p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use one cookie to keep you signed in. It&apos;s needed for the site to work, lasts up to 30 days, and is removed when you log out. Connecting Slack or Discord briefly sets
          another cookie to keep that sign-in safe. We don&apos;t use advertising cookies. If we measure visits to our public pages, we use a privacy-friendly service that sets no cookies and doesn&apos;t track you across sites, and we don&apos;t measure the app itself or anyone&apos;s status page.
        </p>
      </Section>

      <Section heading="Who we share it with">
        <p>Only the companies that help us run the service, and only what they need:</p>
        <ul>
          <li>
            <strong>Stripe</strong> processes payments.
          </li>
          <li>
            <strong>Resend</strong> delivers our emails.
          </li>
          <li>
            <strong>Amazon Web Services</strong> hosts the site and its database, in the United States.
          </li>
          <li>
            <strong>Slack and Discord</strong>, if you connect them, receive the alerts you choose to send there.
          </li>
          <li>
            <strong>Umami</strong>, our website analytics service, if switched on, counts visits to our public pages, such as which pages are read and which sites link to us. It sets no cookies and
            doesn&apos;t build profiles of people.
          </li>
        </ul>
        <p>
          We may also share information if the law requires it, or to protect the service and its users. If the business is ever sold or merged, information may move with it, and we&apos;d tell
          you first.
        </p>
      </Section>

      <Section heading="If you give us other people's information">
        <p>
          If you add your clients&apos; or colleagues&apos; details, such as email addresses for alerts and reports, their names and logos, or the sites you monitor for them, you&apos;re the one deciding why and how that
          information is used, and we handle it on your behalf to run the service. Please make sure you have the right to give it to us, and that the people involved know you use a service like this. If your
          own clients or local law need a data processing agreement, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll provide one.
        </p>
      </Section>

      <Section heading="Status pages are public">
        <p>
          If you turn on a status page, anyone with its link can see the site&apos;s name, its current and past status and any updates you post. Only turn it on for information you&apos;re happy to share.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          We keep your account and settings until you delete the account. Check history is kept for as long as your plan includes (30 days on Free, 90 on Starter, 12 months on Pro, 2 years on Agency)
          and older results are removed. When an account is deleted we remove its data, apart from anything we must keep for tax or legal reasons, such as invoices held by Stripe.
          Backups are overwritten on a regular schedule.
        </p>
      </Section>

      <Section heading="Your choices">
        <ul>
          <li>You can download your data from your account at any time.</li>
          <li>You can edit or remove sites, alert addresses, integrations and API keys yourself.</li>
          <li>You can change or cancel your plan from Manage billing on the Plans page.</li>
          <li>You can delete your account yourself from the Account page. That cancels any paid subscription and permanently deletes your data.</li>
          <li>
            To see or correct the information we hold about you, or if you can&apos;t use the Account page, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on the account.
            If we emailed you because someone else added you as an alert recipient or status page subscriber, you can also use the unsubscribe link in that email.
          </li>
        </ul>
        <p>Depending on where you live, you may have further rights over your information, such as objecting to certain uses or complaining to your local data protection authority. Write to us and we&apos;ll help.</p>
      </Section>

      <Section heading="Security">
        <p>
          We protect your data with encryption in transit (HTTPS), hashed passwords and keys, encrypted integration tokens and limits on who can reach the servers. No system is perfectly secure, so
          please use a strong, unique password.
        </p>
      </Section>

      <Section heading="Children">
        <p>{BRAND} is for businesses and isn&apos;t meant for anyone under 18. We don&apos;t knowingly collect information from children.</p>
      </Section>

      <Section heading="Changes to this policy">
        <p>If we change this policy in a way that matters, we&apos;ll update the date at the top and email account holders about significant changes.</p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about privacy? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
