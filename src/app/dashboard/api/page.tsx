import type { Metadata } from "next";
import ApiAndExport from "@/components/ApiAndExport";

export const metadata: Metadata = {
  title: "API & export",
  robots: { index: false },
};

export default function ApiPage() {
  return <ApiAndExport />;
}
