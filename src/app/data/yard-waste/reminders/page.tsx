import type { Metadata } from "next";
import { Suspense } from "react";
import SiteShell from "@/components/site/SiteShell";
import { ReminderLinkAction } from "@/components/yardWaste/ReminderLinkAction";

export const metadata: Metadata = {
  title: "Yard Waste Reminders",
  robots: { index: false, follow: false },
};

/** Where the links in reminder emails land: confirm a sign-up, or unsubscribe. */
export default function YardWasteRemindersPage() {
  return (
    <SiteShell>
      <section className="mx-auto w-full max-w-xl px-5 py-14 md:px-8">
        <Suspense>
          <ReminderLinkAction />
        </Suspense>
      </section>
    </SiteShell>
  );
}
