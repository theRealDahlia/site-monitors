import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("err-cert-common-name-invalid");

export default function Page() {
  return <GuideArticle slug="err-cert-common-name-invalid" />;
}
