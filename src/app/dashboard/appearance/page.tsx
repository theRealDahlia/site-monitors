import type { Metadata } from "next";
import Appearance from "@/components/Appearance";

export const metadata: Metadata = {
  title: "Appearance",
  robots: { index: false },
};

export default function AppearancePage() {
  return <Appearance />;
}
