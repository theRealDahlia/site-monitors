import type { Metadata } from "next";
import Integrations from "@/components/Integrations";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false },
};

export default function IntegrationsPage() {
  return <Integrations />;
}
