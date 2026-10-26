import PageTransition from "@/components/PageTransition";

// Animates moving between the site's pages, and into and out of the app. Inside the app, its own template does that.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
