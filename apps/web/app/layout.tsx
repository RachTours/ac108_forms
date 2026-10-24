import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { panelNameForAudience } from "../src/lib/panel-brand";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const audience = requestHeaders.get("x-reviewroom-audience");
  const panelName = panelNameForAudience(audience);
  const requestPath = requestHeaders.get("x-reviewroom-request-path");
  const defaultTitle = requestPath === "/reset-password" ? `Reset your password | ${panelName}` : panelName;
  return {
    title: { default: defaultTitle, template: `%s | ${panelName}` },
    applicationName: panelName,
    description: `Secure forms, peer reviews, and team progress in the ${panelName}.`,
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
