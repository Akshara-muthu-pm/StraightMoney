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
  // "optional" tells the browser to use a system font on first load
  // rather than causing a layout shift when the custom font arrives.
  display: "optional",
});

export const metadata: Metadata = {
  title: "StraightMoney · Transparent Community Fundraising (PayPal AI Hackathon)",
  description:
    "Community fundraising where the organizer never holds the money. Secured by PayPal Orders v2, PayPal Payouts, and Gemini AI verification.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23001435'/><path d='M7 5h10.5c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L9.5 29H5.2L7 5z' fill='%23003087'/><path d='M11.5 8.5H22c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L14 32.5H9.7l2.8-24z' fill='%23009CDE'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23001435'/><path d='M7 5h10.5c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L9.5 29H5.2L7 5z' fill='%23003087'/><path d='M11.5 8.5H22c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L14 32.5H9.7l2.8-24z' fill='%23009CDE'/></svg>"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("straightmoney-theme");var p=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=m==="dark"||(m!=="light"&&p)?"dark":"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F5F7FA] text-[#001435] antialiased">
        <div className="liquid-mesh-grid" aria-hidden="true" />
        <div className="liquid-orb-1" aria-hidden="true" />
        <div className="liquid-orb-2" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <SiteMotion>
            <Header />
            {children}
            <footer className="mt-16 border-t border-white/70 bg-white/60 py-10 text-sm text-slate-600 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/60">
            <div className="page-width grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#003087] text-xs font-black text-white">
                    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
                      <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
                      <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
                    </svg>
                  </span>
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
