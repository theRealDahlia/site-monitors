import { AppGuideArticle, appGuideMetadata } from "@/components/GuideArticle";

// Title comes from the guide's entry in src/lib/guides.ts.
export const metadata = appGuideMetadata("err-cert-common-name-invalid");

export default function Page() {
  return <AppGuideArticle slug="err-cert-common-name-invalid" />;
}
