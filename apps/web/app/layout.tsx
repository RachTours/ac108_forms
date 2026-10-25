import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { directionForLocale, type Locale } from "../src/lib/locale";

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
  return <html lang={locale} dir={directionForLocale(locale)}><body><NextIntlClientProvider>{children}</NextIntlClientProvider></body></html>;
}
