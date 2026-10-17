import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("ssl-certificate-expired");

export default function Page() {
  return <AppGuideArticle slug="ssl-certificate-expired" />;
}
