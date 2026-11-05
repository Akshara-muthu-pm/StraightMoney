"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOutDemo } from "@/lib/demo-session";
import { api } from "@/lib/api";
import { setAccount } from "@/lib/account-session";
import styles from "./signin.module.css";

type RoleId = "organizer" | "vendor" | "verifier" | "donor";
type AuthTab = "login" | "register";

const ALL_ROLES = [
  {
    id: "organizer" as const,
    name: "Organizer" as const,
    title: "Organizer",
    icon: "🏛️",
    badge: "Campaign Lead",
    path: "/organizer",
    detail: "Manage campaigns, define budgets & track payouts",
    storyHeadline: "Create campaigns with transparent budgets.",
    storyText: "Set line-item budget caps, assign certified vendors, and monitor payouts without ever taking custody of donor funds.",
  },
  {
    id: "vendor" as const,
    name: "Vendor" as const,
    title: "Vendor",
    icon: "📦",
    badge: "Contractor",
    path: "/vendor",
    detail: "Submit invoices & delivery proof for Gemini AI check",
    storyHeadline: "Upload delivery proof and get paid directly.",
    storyText: "Submit invoice PDFs and delivery photos. Gemini AI extracts fields and Python rules verify budget limits before payout.",
  },
  {
    id: "verifier" as const,
    name: "Verifier" as const,
    title: "Verifier",
    icon: "🔍",
    badge: "Auditor",
    path: "/verifier",
    detail: "Inspect Gemini OCR checks & approve payouts",
    storyHeadline: "Independent human review of AI audit results.",
    storyText: "Audit Gemini OCR extraction, check 8 automated policy rules, and authorize PayPal payouts with immutable ledger recording.",
  },
  {
    id: "donor" as const,
    name: "Donor" as const,
    title: "Donor",
    icon: "💙",
    badge: "Community",
    path: "/donor",
    detail: "Public donations, receipts & transparency ledger",
    storyHeadline: "Track every dollar from checkout to delivery.",
    storyText: "Donate through PayPal Orders v2 into a protected campaign pool. Query spending anytime with the AI ledger assistant.",
  },
] as const;

export default function SignInPage() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<RoleId>("organizer");
  const [authTab, setAuthTab] = useState<AuthTab>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const currentRole = ALL_ROLES.find((r) => r.id === activeRole) ?? ALL_ROLES[0];

  function selectRole(roleId: RoleId) {
    setActiveRole(roleId);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (activeRole === "donor") {
        router.push("/donor");
        return;
      }

      const account =
        authTab === "login"
          ? await api.login(email, password)
          : await api.registerAccount(activeRole, {
              name,
              email,
              password,
              ...(activeRole === "vendor" ? { invite_token: inviteToken } : {}),
              ...(activeRole === "verifier" ? { bootstrap_key: bootstrapKey } : {}),
            });

      signOutDemo();
      setAccount(account);
      router.push(`/${account.role}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not authenticate. Please check your credentials.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.shell}>
        {/* Left Hero Story Column */}
        <section className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyInner}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} /> STRAIGHTMONEY WORKSPACE
            </div>
            <h1 id="story-title">
              Good work deserves <span>clear money trails.</span>
            </h1>
            <p className={styles.storyCopy}>
              Keep campaign spending accountable, from the first contribution to the final vendor payout.
            </p>

            {/* Dynamic Role Highlight Card */}
            <div className={styles.roleHighlightBadge}>
              <span className={styles.roleHighlightIcon} aria-hidden="true">{currentRole.icon}</span>
              <div>
                <strong>{currentRole.title}: {currentRole.storyHeadline}</strong>
                <p>{currentRole.storyText}</p>
              </div>
            </div>

            <div className={styles.flow} aria-label="How campaign funds are tracked">
              <div className={styles.flowItem}>
                <span className={styles.flowIcon}>01</span>
                <div>
                  <strong>Contributions captured</strong>
                  <small>PayPal Orders v2 with public ledger entries.</small>
                </div>
              </div>
              <div className={styles.flowItem}>
                <span className={styles.flowIcon}>02</span>
                <div>
                  <strong>Invoices independently reviewed</strong>
                  <small>Gemini OCR field validation &amp; 8 policy checks.</small>
                </div>
              </div>
              <div className={styles.flowItem}>
                <span className={styles.flowIcon}>03</span>
                <div>
                  <strong>Payouts directly disbursed</strong>
                  <small>Funds go to vendor accounts, never organizer custody.</small>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.storyFoot}>
            <span className={styles.goldLine} /> Built for transparent giving · PayPal Sandbox
          </div>
        </section>

        {/* Right Access Control Column */}
        <section className={styles.access} aria-labelledby="access-title">
          <div className={styles.accessHead}>
            <div className={styles.productMark} aria-hidden="true">
              S<span>M</span>
            </div>
            <div>
              <strong>StraightMoney</strong>
              <small>Secure Workspace Access</small>
            </div>
          </div>

          <span className={styles.sectionLabel}>AUTHENTICATE ACCESS</span>
          <h2 id="access-title">
            {authTab === "login" ? `Sign In as ${currentRole.title}` : `Create ${currentRole.title} Account`}
          </h2>
          <p className={styles.intro}>
            {authTab === "login"
              ? "Enter your account email and password to access your role dashboard."
              : "Register your account with verified credentials to join this workspace."}
          </p>

          {/* Interactive Role Selector */}
          <div className={styles.roleChoices} role="group" aria-label="Select workspace role">
            {ALL_ROLES.map((role) => {
              const isSelected = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role.id)}
                  aria-pressed={isSelected}
                  className={isSelected ? styles.roleSelected : styles.roleChoice}
                >
                  <div className={styles.roleChoiceHeader}>
                    <span className={styles.roleIcon} aria-hidden="true">{role.icon}</span>
                    {isSelected && <span className={styles.roleCheck}>Selected ✓</span>}
                  </div>
                  <div>
                    <strong>{role.title}</strong>
                    <small>{role.detail}</small>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Access Mode Switcher Tabs (Sign in / Register) */}
          <div className={styles.switcher} role="group" aria-label="Authentication method">
            <button
              type="button"
              className={authTab === "login" ? styles.switchActive : ""}
              onClick={() => { setAuthTab("login"); setError(""); }}
              aria-pressed={authTab === "login"}
            >
              🔑 Sign in
            </button>
            <button
              type="button"
              className={authTab === "register" ? styles.switchActive : ""}
              onClick={() => { setAuthTab("register"); setError(""); }}
              aria-pressed={authTab === "register"}
            >
              📝 Create Account
            </button>
          </div>

          {/* Donor Exploration View */}
          {activeRole === "donor" ? (
            <div className="space-y-4 rounded-2xl border border-blue-200/90 bg-blue-50/80 p-5 dark:border-blue-900/60 dark:bg-blue-950/40">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">💙</span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#001435] dark:text-white">
                    Public Community Donor Access
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Donors do not require server credentials to browse campaigns, make PayPal contributions, or audit the public ledger.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 pt-2">
                <Link
                  href="/explore"
                  className="inline-flex items-center justify-center rounded-full bg-[#003087] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#00276c] shadow-sm"
                >
                  Browse Campaigns →
                </Link>
                <Link
                  href="/donor"
                  className="inline-flex items-center justify-center rounded-full border border-blue-300 bg-white px-4 py-2.5 text-xs font-bold text-[#003087] transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-sky-300"
                >
                  Open Donor Workspace →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className={styles.form}>
              {authTab === "register" && (
                <label htmlFor="account-name">
                  Full name
                  <input
                    id="account-name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="e.g. Alex Morgan"
                  />
                </label>
              )}

              <label htmlFor="account-email">
                Email address
                <input
                  id="account-email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </label>

              <label htmlFor="account-password">
                Password
                <span className={styles.passwordField}>
                  <input
                    id="account-password"
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={authTab === "register" ? 12 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={authTab === "register" ? "new-password" : "current-password"}
                    placeholder={authTab === "register" ? "At least 12 characters" : "Enter your password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                {authTab === "register" && (
                  <small>Use at least 12 characters to protect your campaign workspace.</small>
                )}
              </label>

              {authTab === "register" && activeRole === "vendor" && (
                <label htmlFor="vendor-invite">
                  Invitation token
                  <input
                    id="vendor-invite"
                    required
                    value={inviteToken}
                    onChange={(event) => setInviteToken(event.target.value)}
                    autoComplete="off"
                    placeholder="Token provided by your campaign organizer"
                  />
                  <small>Must match the registered payout email assigned by the campaign organizer.</small>
                </label>
              )}

              {authTab === "register" && activeRole === "verifier" && (
                <label htmlFor="verifier-key">
                  Verifier enrollment key
                  <input
                    id="verifier-key"
                    required
                    type="password"
                    value={bootstrapKey}
                    onChange={(event) => setBootstrapKey(event.target.value)}
                    autoComplete="off"
                    placeholder="Enter cryptographic enrollment key"
                  />
                  <small>Required to authorize human verifier decision powers.</small>
                </label>
              )}

              {error && <p className={styles.error} role="alert">{error}</p>}

              <button type="submit" disabled={pending} className={styles.submit}>
                {pending
                  ? "Authenticating…"
                  : authTab === "login"
                  ? `Sign In as ${currentRole.title}`
                  : `Register ${currentRole.title} Account`}
                {!pending && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          <div className={styles.accessFoot}>
            <Link href="/explore">Browse campaigns</Link>
            <Link href="/donor">Public donor view</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
