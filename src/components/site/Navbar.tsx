"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/data", label: "Data Hub" },
  { href: "/writings", label: "Writings" },
  { href: "/action", label: "Take Action" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[color:var(--color-bg)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logos/abundantcu-logo.png"
            alt="Abundant CU"
            width={34}
            height={34}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-sm uppercase tracking-[0.12em] text-[var(--color-primary)]">
            <span className="font-extrabold">ABUNDANT</span>
            <span className="font-medium"> CU</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={
                isActive(link.href)
                  ? "border-b-2 border-[var(--color-primary)] pb-0.5 font-semibold"
                  : "transition-opacity hover:opacity-70"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger button */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="-mr-2 rounded-[4px] p-2 transition-colors hover:bg-slate-100 md:hidden"
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile nav — animated slide */}
      <div
        id="mobile-nav"
        className={`overflow-hidden border-t border-[var(--color-border)] transition-all duration-200 ease-in-out md:hidden ${
          menuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Mobile navigation" className="mx-auto flex max-w-6xl flex-col px-5 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`border-b border-[var(--color-border)] py-3 text-sm last:border-b-0 ${
                isActive(link.href)
                  ? "font-semibold text-[var(--color-primary)]"
                  : "font-medium text-slate-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
