"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOutDemo } from "@/lib/demo-session";
import { api } from "@/lib/api";
import { setAccount } from "@/lib/account-session";
import styles from "./signin.module.css";

type RoleId = "organizer" | "vendor" | "verifier";
type AuthTab = "login" | "register";
const roles: { id: RoleId; label: string }[] = [
  { id: "organizer", label: "Organizer" },
  { id: "vendor", label: "Vendor" },
  { id: "verifier", label: "Verifier" },
];

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const account = authTab === "login"
        ? await api.login(email, password)
        : await api.registerAccount(activeRole, {
            name, email, password,
            ...(activeRole === "vendor" && inviteToken.trim() ? { invite_token: inviteToken.trim() } : {}),
            ...(activeRole === "verifier" ? { bootstrap_key: bootstrapKey } : {}),
          });
      signOutDemo();
      setAccount(account);
      router.push(`/${account.role}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Please check your details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>STRAIGHTMONEY</p>
          <h1>{authTab === "login" ? "Welcome back." : "Get started."}</h1>
          <p>Manage campaigns, review work, and follow payments in one place.</p>
          <Link href="/explore">Explore campaigns <span aria-hidden="true">→</span></Link>
        </div>

        <section className={styles.card} aria-labelledby="access-title">
          <div className={styles.tabs} role="group" aria-label="Account access">
            <button type="button" aria-pressed={authTab === "login"} onClick={() => { setAuthTab("login"); setError(""); }}>Sign in</button>
            <button type="button" aria-pressed={authTab === "register"} onClick={() => { setAuthTab("register"); setError(""); }}>Create account</button>
          </div>
          <h2 id="access-title">{authTab === "login" ? "Sign in to your account" : "Create an account"}</h2>
          <p className={styles.subtitle}>{authTab === "login" ? "Enter your email and password to continue." : "Choose your workspace and enter your details."}</p>

          {authTab === "register" && (
            <fieldset className={styles.roles}>
              <legend>Workspace role</legend>
              <div>{roles.map((role) => (
                <button key={role.id} type="button" aria-pressed={activeRole === role.id} onClick={() => { setActiveRole(role.id); setError(""); }}>{role.label}</button>
              ))}</div>
            </fieldset>
          )}

          <form onSubmit={submit} className={styles.form}>
            {authTab === "register" && <label htmlFor="account-name">Full name
              <input id="account-name" required value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" placeholder="Alex Morgan" />
            </label>}
            <label htmlFor="account-email">Email address
              <input id="account-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" />
            </label>
            <label htmlFor="account-password">Password
              <span className={styles.passwordField}>
                <input id="account-password" required type={showPassword ? "text" : "password"} minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authTab === "register" ? "new-password" : "current-password"} placeholder={authTab === "register" ? "At least 12 characters" : "Enter your password"} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </span>
            </label>
            {authTab === "register" && activeRole === "verifier" && <label htmlFor="verifier-key">Verifier enrollment key
              <input id="verifier-key" required type="password" value={bootstrapKey} onChange={(event) => setBootstrapKey(event.target.value)} autoComplete="off" placeholder="Enter your private enrollment key" />
            </label>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={pending} className={styles.submit}>{pending ? "Please wait…" : authTab === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className={styles.donorNote}>Just here to give? <Link href="/explore">Browse campaigns</Link></p>
        </section>
      </div>
    </main>
  );
}
