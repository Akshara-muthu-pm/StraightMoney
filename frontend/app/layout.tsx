import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import SiteMotion from "@/components/SiteMotion";
import "./globals.css";

const jakarta = localFont({ src: "./fonts/PlusJakartaSans.ttf", variable: "--font-jakarta", weight: "200 800", display: "swap" });
const lora = localFont({
  src: [
    { path: "./fonts/Lora.ttf", weight: "400 700", style: "normal" },
    { path: "./fonts/Lora-Italic.ttf", weight: "400 700", style: "italic" },
  ],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StraightMoney",
  description: "A brighter corner of the community. Support projects and follow the work behind every contribution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="harbor-blue" className={`${jakarta.variable} ${lora.variable}`}><body className="min-h-screen bg-slate-50 text-slate-900"><a href="#main-content" className="skip-link">Skip to main content</a><SiteMotion><Header />{children}<footer className="mx-auto max-w-6xl border-t border-slate-200 px-5 py-8 text-sm text-slate-600">StraightMoney · Community powered. Progress shared.</footer></SiteMotion></body></html>;
}
