import type { Metadata } from "next";
import Notifications from "@/components/Notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false },
};

export default function NotificationsPage() {
  return <Notifications />;
}
