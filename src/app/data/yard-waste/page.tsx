import type { Metadata } from "next";
import YardWasteDashboard from "@/components/yardWaste/YardWasteDashboard";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Yard Waste Collection — City of Champaign",
  description:
    "Find your City of Champaign yard waste collection zone and pickup dates by address, add them to your calendar, or get an email reminder before each pickup.",
  openGraph: {
    title: "Yard Waste Collection — City of Champaign | Abundant CU",
    description:
      "Find your City of Champaign yard waste collection zone and pickup dates by address, add them to your calendar, or get an email reminder before each pickup.",
    url: "https://abundantcu.com/data/yard-waste",
  },
};

export default function YardWastePage() {
  // Email reminders need Supabase (to store sign-ups) and Resend (to send). Without them the page offers the calendar
  // download and the city's own notification list instead.
  const remindersEnabled = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL,
  );
  return (
    <SiteShell>
      <YardWasteDashboard remindersEnabled={remindersEnabled} />
    </SiteShell>
  );
}
