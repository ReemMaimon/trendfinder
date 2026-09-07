import type { Metadata, Viewport } from "next";
import "./globals.css";
import { env } from "@/lib/env";

const siteName = "TrendFinder — המוצרים החמים של היום";
const description =
  "כל יום אנחנו מגלים טרנדים מתפרצים של מוצרים, חוקרים אותם ברשת עם בינה מלאכותית ומוצאים את המוצרים התואמים ב-AliExpress. 3 מוצרים נבחרים בכל בוקר.";

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: siteName, template: "%s · TrendFinder" },
  description,
  applicationName: "TrendFinder",
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "TrendFinder",
    title: siteName,
    description,
    url: env.SITE_URL,
  },
  twitter: { card: "summary_large_image", title: siteName, description },
  robots: { index: true, follow: true },
  alternates: { canonical: env.SITE_URL },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
