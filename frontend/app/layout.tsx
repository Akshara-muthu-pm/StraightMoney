import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("straightmoney-theme");var p=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=m==="dark"||(m!=="light"&&p)?"dark":"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F5F7FA] text-[#001435] antialiased">
        {/* Liquid Glass Ambient Mesh & Caustic Orbs */}
        <div className="liquid-mesh-grid" aria-hidden="true" />
        <div className="liquid-orb-1" aria-hidden="true" />
        <div className="liquid-orb-2" aria-hidden="true" />
        <div className="liquid-orb-3" aria-hidden="true" />
        <div className="liquid-orb-4" aria-hidden="true" />

        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <SiteMotion>
            <Header />
            {children}
            <footer className="mt-24 border-t border-white/80 bg-white/60 py-14 text-sm text-slate-600 backdrop-blur-2xl shadow-inner">
            <div className="page-width grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0079C1] text-xs font-black text-white shadow-md shadow-blue-900/20 ring-1 ring-white/50">
                    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
                      <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
                      <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
                    </svg>
                  </span>
                  <span className="text-lg font-extrabold tracking-tight text-[#001435]">
                    Straight<span className="text-[#0070BA]">Money</span>
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Zero-custody community fundraising powered by PayPal Orders v2, PayPal Payouts, and Gemini AI invoice verification.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-3 py-1 text-[11px] font-black text-[#003087] shadow-sm backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
                  PayPal Orders v2 &amp; Payouts
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[#001435]">Fundraising Flow</h4>
                <ul className="mt-3.5 space-y-2 text-xs font-semibold">
                  <li><Link href="/explore" className="text-slate-600 transition hover:text-[#0070BA]">Explore Campaigns</Link></li>
                  <li><Link href="/#how-it-works" className="text-slate-600 transition hover:text-[#0070BA]">How Funds Move</Link></li>
                  <li><Link href="/ledger/1" className="text-slate-600 transition hover:text-[#0070BA]">School Library Public Ledger</Link></li>
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

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[#001435]">Sandbox payment flow</h4>
                <p className="mt-3.5 text-xs leading-relaxed text-slate-500">
                  Organizers never hold funds. Donations are captured directly into the campaign balance and disbursed via PayPal Payouts to verified vendor accounts.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <span>PayPal AI Hackathon 2026</span>
                </div>
              </div>
            </div>

            <div className="page-width mt-12 border-t border-slate-200/70 pt-6 text-xs text-slate-500 flex flex-wrap justify-between items-center gap-4">
              <span>&copy; 2026 StraightMoney. MIT License. PayPal AI Hackathon prototype.</span>
              <span className="flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3.5 py-1 text-xs font-black text-emerald-900 shadow-sm backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PayPal Sandbox Prototype</span>
              </span>
            </div>
          </footer>
        </SiteMotion>
      </ThemeProvider>
    </body>
  </html>
);
}
