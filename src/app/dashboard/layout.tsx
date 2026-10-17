import AppShell from "@/components/AppShell";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      {/* Applies the account's saved light/dark and colour before anything is drawn, so it doesn't flash. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <AppShell>{children}</AppShell>
    </>
  );
}
