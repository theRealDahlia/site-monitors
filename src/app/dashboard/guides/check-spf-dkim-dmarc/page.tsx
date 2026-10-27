import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("check-spf-dkim-dmarc");

export default function Page() {
  return <AppGuideArticle slug="check-spf-dkim-dmarc" />;
}
