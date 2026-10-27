import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("monitor-client-websites");

export default function Page() {
  return <GuideArticle slug="monitor-client-websites" />;
}
