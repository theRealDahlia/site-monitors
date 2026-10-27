import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("status-page-for-clients");

export default function Page() {
  return <AppGuideArticle slug="status-page-for-clients" />;
}
