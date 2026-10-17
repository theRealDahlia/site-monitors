import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("how-to-check-when-a-domain-expires");

export default function Page() {
  return <AppGuideArticle slug="how-to-check-when-a-domain-expires" />;
}
