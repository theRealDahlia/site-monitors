import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("ssl-certificate-expired");

export default function Page() {
  return <GuideArticle slug="ssl-certificate-expired" />;
}
