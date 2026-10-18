import type { Metadata } from "next";
import AiVisibility from "@/components/AiVisibility";

export const metadata: Metadata = {
  title: "AI visibility",
  robots: { index: false },
};

export default function AiVisibilityPage() {
  return <AiVisibility />;
}
