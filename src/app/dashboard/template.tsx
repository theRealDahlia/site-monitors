import PageTransition from "@/components/PageTransition";

// Animates moving between the app's pages. It sits inside the app's layout, so the menu stays still. The old page fades
// out here; the new one fades in by itself once its data has loaded (see .app-page in globals.css), since most app
// pages show "Loading…" first and animating that would leave the real content to pop in unannounced.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition enter={false}>{children}</PageTransition>;
}
