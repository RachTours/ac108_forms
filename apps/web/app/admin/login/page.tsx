import type { Metadata } from "next";
import { LoginForm } from "../../../src/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <Brand />
    <p className="eyebrow">ADMIN ACCESS</p>
    <h1 id="login-title">Workspace administration</h1>
    <p>Sign in with an owner or administrator account.</p>
    <LoginForm audience="admin" />
  </section></main>;
}

function Brand() { return <div className="brand"><span className="brand-mark">A</span><span>Admin Panel</span></div>; }
