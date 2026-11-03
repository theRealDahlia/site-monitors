import type { FaqItem } from "@/components/Faq";

// Questions shared by the home page and the pricing page, so their answers can't drift apart.

const FREE: FaqItem = {
  q: "Is the free plan really free?",
  a: "Yes. There's no credit card to enter and no trial that ends. You can watch up to 5 sites for as long as you like.",
};

const SITE: FaqItem = {
  q: "What counts as a site?",
  a: "One hostname, such as example.com. Each site gets uptime, SSL certificate and domain expiry checks. www.example.com and example.com are separate hostnames, so they count as two sites.",
};

const EMAILS: FaqItem = {
  q: "What emails will I get?",
  a: "A confirmation when you add a site, and then alerts only when something needs attention: an SSL certificate nearing expiry (30, 14, 7, 3 and 1 days before), a domain nearing expiry (60, 30, 14, 7 and 1 days before), a certificate problem, or a site going down. We only report a site as down after two failed checks in a row, and we email again when it's back up.",
};

const CHECKERS: FaqItem = {
  q: "Do I need an account to use the free checkers?",
  a: "No. Without an account you get 4 checks a day across the SSL and domain checkers. With an account you add sites to your dashboard instead, and we check them for you around the clock.",
};

const PAY: FaqItem = {
  q: "How do I pay, and can I cancel?",
  a: "Starter, Pro and Agency are monthly subscriptions paid by card through Stripe. You can change plan, update your card, download invoices or cancel from your Plans page whenever you like. Changing plan or cancelling takes effect at once, and the unused days are refunded to your card.",
};

const MORE: FaqItem = {
  q: "What happens if I want more than 5 sites?",
  a: "You'll need to remove a site before adding another. Starter (25 sites) and Pro (100 sites) have higher limits.",
};


export const PRICING_FAQ: FaqItem[] = [FREE, SITE, EMAILS, CHECKERS, PAY, MORE];
export const HOME_FAQ: FaqItem[] = [FREE, SITE, EMAILS, CHECKERS, PAY];
