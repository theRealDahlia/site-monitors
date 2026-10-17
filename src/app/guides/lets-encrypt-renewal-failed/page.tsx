import { GuideArticle, guideMetadata } from "@/components/GuideArticle";

// Title, description and share tags come from the guide's entry in src/lib/guides.ts.
export const metadata = guideMetadata("lets-encrypt-renewal-failed");

export default function Page() {
  return <GuideArticle slug="lets-encrypt-renewal-failed" />;
}
