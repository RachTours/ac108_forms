import type { Metadata } from "next";
import { LoginForm } from "../../../src/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function ReviewerLoginPage() {
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <Brand />
    <p className="eyebrow">REVIEWER ACCESS</p>
    <h1 id="login-title">Welcome back</h1>
    <p>Sign in to see your assigned reviews and progress.</p>
    <LoginForm audience="reviewer" />
  </section></main>;
}

function Brand() { return <div className="brand"><span className="brand-mark">R</span><span>Reviewer Panel</span></div>; }
