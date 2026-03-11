import type { Metadata } from "next";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og/data.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/data.png"],
  },
};

export default function DataLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
