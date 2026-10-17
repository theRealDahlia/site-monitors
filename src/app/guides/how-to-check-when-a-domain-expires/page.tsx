import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("how-to-check-when-a-domain-expires");

export default function Page() {
  return <GuideArticle slug="how-to-check-when-a-domain-expires" />;
}
