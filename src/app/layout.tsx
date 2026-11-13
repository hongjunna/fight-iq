import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, Noto_Sans_KR } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, socialMetadata } from "@/lib/site";
import "./globals.css";

// 제목: 굵고 단단한 Black Han Sans, 본문: 읽기 편한 Noto Sans KR
const display = Black_Han_Sans({ variable: "--font-display", weight: "400", subsets: ["latin"], preload: false });
const body = Noto_Sans_KR({ variable: "--font-body", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Fight IQ" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["MMA 퀴즈", "UFC 퀴즈", "격투기 퀴즈", "복싱", "주짓수", "레슬링", "킥복싱", "무에타이", "Fight IQ"],
  alternates: { canonical: "/" },
  ...socialMetadata(SITE_TITLE, SITE_DESCRIPTION, "/"),
  robots: { index: true, follow: true },
  formatDetection: { email: false, telephone: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#16110F" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
