import type { Metadata } from "next";
import localFont from "next/font/local";
import SiteHeader from "@/components/SiteHeader";
import StraightMoneyLogo from "@/components/StraightMoneyLogo";
import SiteMotion from "@/components/SiteMotion";
import { ThemeProvider } from "@/components/ThemeProvider";
import Link from "next/link";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/PlusJakartaSans.ttf",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StraightMoney · Transparent Community Fundraising (PayPal AI Hackathon)",
  description:
    "Community fundraising where the organizer never holds the money. Secured by PayPal Orders v2, PayPal Payouts, and Gemini AI verification.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${jakarta.variable} ${jakarta.className}`}>
      <body className="min-h-screen bg-[#F5F7FA] text-[#001435] antialiased">
        <div className="liquid-mesh-grid" aria-hidden="true" />
        <div className="liquid-orb-1" aria-hidden="true" />
        <div className="liquid-orb-2" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <SiteMotion>
            <SiteHeader />
            {children}
            <footer className="mt-16 border-t border-white/70 bg-white/60 py-10 text-sm text-slate-600 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/60">
            <div className="page-width grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <StraightMoneyLogo size={36} idPrefix="footer-logo" />
                  <span className="text-lg font-extrabold tracking-tight text-[#001435]">
                    Straight<span className="text-[#0070BA]">Money</span>
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">Transparent giving with public budgets and direct vendor payouts.</p>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[#001435]">Fundraising Flow</h4>
                <ul className="mt-3.5 space-y-2 text-xs font-semibold">
                  <li><Link href="/explore" className="text-slate-600 transition hover:text-[#0070BA]">Explore Campaigns</Link></li>
                  <li><Link href="/#how-it-works" className="text-slate-600 transition hover:text-[#0070BA]">How Funds Move</Link></li>
                  <li><Link href="/donate" className="text-slate-600 transition hover:text-[#0070BA]">Support a Project</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[#001435]">Role Workspaces</h4>
                <ul className="mt-3.5 space-y-2 text-xs font-semibold">
                  <li><Link href="/donor" className="text-slate-600 transition hover:text-[#0070BA]">Donor Dashboard</Link></li>
                  <li><Link href="/organizer" className="text-slate-600 transition hover:text-[#0070BA]">Organizer Console</Link></li>
                  <li><Link href="/vendor" className="text-slate-600 transition hover:text-[#0070BA]">Vendor Invoicing</Link></li>
                  <li><Link href="/verifier" className="text-slate-600 transition hover:text-[#0070BA]">Verifier Approval Queue</Link></li>
                </ul>
              </div>

            </div>

            <div className="page-width mt-8 border-t border-slate-200/70 pt-5 text-xs text-slate-500 dark:border-slate-800">
              <span>&copy; 2026 StraightMoney. PayPal sandbox prototype.</span>
            </div>
          </footer>
        </SiteMotion>
      </ThemeProvider>
    </body>
  </html>
);
}
