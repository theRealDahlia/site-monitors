import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("status-page-for-clients");

export default function Page() {
  return <GuideArticle slug="status-page-for-clients" />;
}
