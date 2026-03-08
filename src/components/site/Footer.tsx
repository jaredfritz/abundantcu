import EmailSignupForm from "@/components/forms/EmailSignupForm";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 md:grid-cols-2 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Abundant CU</p>
          <p className="mt-3 max-w-md text-sm text-slate-700">
            Stay updated and informed. We&apos;ll share relevant policy updates and data insights from time to time.
          </p>
        </div>
        <div>
          <EmailSignupForm sourcePage="footer" compact />
        </div>
      </div>
      <div className="border-t border-[var(--color-border)] px-5 py-4 text-center text-xs text-slate-600">
        © 2026 Abundant CU.
      </div>
    </footer>
  );
}
