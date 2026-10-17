import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("lets-encrypt-renewal-failed");

export default function Page() {
  return <AppGuideArticle slug="lets-encrypt-renewal-failed" />;
}
