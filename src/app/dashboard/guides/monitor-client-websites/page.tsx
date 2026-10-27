import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("monitor-client-websites");

export default function Page() {
  return <AppGuideArticle slug="monitor-client-websites" />;
}
