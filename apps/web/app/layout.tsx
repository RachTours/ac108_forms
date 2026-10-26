import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { directionForLocale, type Locale } from "../src/lib/locale";
import { PlatformThemePreferences } from "../src/components/platform-theme-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const audience = requestHeaders.get("x-reviewroom-audience");
  const t = await getTranslations("metadata");
  const panelName = t(audience === "reviewer" ? "reviewer" : "admin");
  const requestPath = requestHeaders.get("x-reviewroom-request-path");
  const defaultTitle = requestPath === "/reset-password" ? `${t("resetPassword")} | ${panelName}` : panelName;
  return {
    title: { default: defaultTitle, template: `%s | ${panelName}` },
    applicationName: panelName,
    description: t("description", { panel: panelName }),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale() as Locale;
  const requestHeaders = await headers();
  const audience = requestHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const store = await cookies();
  const modes = { admin: store.get("rr_mode_admin")?.value === "dark" ? "dark" as const : "light" as const, reviewer: store.get("rr_mode_reviewer")?.value === "dark" ? "dark" as const : "light" as const };
  return <html lang={locale} dir={directionForLocale(locale)} data-platform={audience} data-ui-theme={modes[audience]}><body><NextIntlClientProvider><PlatformThemePreferences initial={modes}>{children}</PlatformThemePreferences></NextIntlClientProvider></body></html>;
}
