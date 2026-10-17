import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("47-day-ssl-certificates");

export default function Page() {
  return <AppGuideArticle slug="47-day-ssl-certificates" />;
}
