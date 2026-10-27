import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("check-spf-dkim-dmarc");

export default function Page() {
  return <GuideArticle slug="check-spf-dkim-dmarc" />;
}
