import EmailSignupForm from "@/components/forms/EmailSignupForm";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-7 md:grid-cols-2 md:items-center md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Abundant CU</p>
          <p className="mt-2 max-w-md text-sm text-slate-700">
            Sign up to stay informed and receive occasional updates. We&apos;ll share relevant data and policy insights
            from time to time.
          </p>
        </div>
        <div>
          <EmailSignupForm sourcePage="footer" compact />
        </div>
      </div>
      <div className="border-t border-[var(--color-border)] px-5 py-3 text-center text-xs text-slate-600">
        © 2026 Abundant CU
      </div>
    </footer>
  );
}
