import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "../../../src/features/auth/login-form";
import { LanguageSwitcher } from "../../../src/components/language-switcher";
import { PlatformThemeToggle } from "../../../src/components/platform-theme-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function ReviewerLoginPage() {
  const t = await getTranslations("auth");
  const navigation = await getTranslations("navigation");
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <div className="login-card-tools"><PlatformThemeToggle platform="reviewer" /><LanguageSwitcher /></div>
    <Brand label={navigation("reviewerPanel")} />
    <p className="eyebrow">{t("reviewerAccess")}</p>
    <h1 id="login-title">{t("reviewerTitle")}</h1>
    <p>{t("reviewerDescription")}</p>
    <LoginForm audience="reviewer" />
  </section></main>;
}

function Brand({ label }: { label: string }) { return <div className="brand"><span className="brand-mark">R</span><span>{label}</span></div>; }
