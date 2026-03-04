import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[color:var(--color-bg)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logos/abundantcu-logo.png"
            alt="Abundant CU logo"
            width={34}
            height={34}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-sm font-semibold uppercase tracking-[0.12em]">Abundant CU</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/zoning" className="hover:opacity-70">Zoning</Link>
          <Link href="/writings" className="hover:opacity-70">Writings</Link>
          <Link href="/action" className="hover:opacity-70">Take Action</Link>
        </nav>
      </div>
    </header>
  );
}
