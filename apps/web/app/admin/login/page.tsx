import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "../../../src/features/auth/login-form";
import { LanguageSwitcher } from "../../../src/components/language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function AdminLoginPage() {
  const t = await getTranslations("auth");
  const navigation = await getTranslations("navigation");
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <LanguageSwitcher />
    <Brand label={navigation("adminPanel")} />
    <p className="eyebrow">{t("adminAccess")}</p>
    <h1 id="login-title">{t("adminTitle")}</h1>
    <p>{t("adminDescription")}</p>
    <LoginForm audience="admin" />
  </section></main>;
}

function Brand({ label }: { label: string }) { return <div className="brand"><span className="brand-mark">A</span><span>{label}</span></div>; }
