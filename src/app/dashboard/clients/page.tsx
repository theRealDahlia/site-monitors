import type { Metadata } from "next";
import Clients from "@/components/Clients";

export const metadata: Metadata = {
  title: "Clients",
  robots: { index: false },
};

export default function ClientsPage() {
  return <Clients />;
}
