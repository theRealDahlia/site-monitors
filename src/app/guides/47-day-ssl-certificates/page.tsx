import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("47-day-ssl-certificates");

export default function Page() {
  return <GuideArticle slug="47-day-ssl-certificates" />;
}
