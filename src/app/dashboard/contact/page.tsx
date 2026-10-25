import type { Metadata } from "next";
import Contact from "@/components/Contact";

export const metadata: Metadata = {
  title: "Contact us",
  robots: { index: false },
};

export default function ContactPage() {
  return <Contact />;
}
