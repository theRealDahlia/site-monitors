import type { Metadata } from "next";
import WhiteLabel from "@/components/WhiteLabel";

export const metadata: Metadata = {
  title: "White label",
  robots: { index: false },
};

export default function WhiteLabelPage() {
  return <WhiteLabel />;
}
