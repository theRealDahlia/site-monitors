import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("monitor-cron-jobs-heartbeat");

export default function Page() {
  return <AppGuideArticle slug="monitor-cron-jobs-heartbeat" />;
}
