import Footer from "@/components/site/Footer";
import Navbar from "@/components/site/Navbar";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-primary)]">
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
