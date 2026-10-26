"use client";

import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

type Platform = "admin" | "reviewer";
type Mode = "light" | "dark";
type Preferences = Record<Platform, Mode>;
const PreferencesContext = createContext<Preferences>({ admin: "light", reviewer: "light" });
const memoryModes: Partial<Preferences> = {};
export function PlatformThemePreferences({ initial, children }: { initial: Preferences; children: React.ReactNode }) {
  return <PreferencesContext.Provider value={initial}>{children}</PreferencesContext.Provider>;
}
const eventName = "reviewroom-theme-change";
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}
function savedMode(platform: Platform, fallback: Mode): Mode {
  try { const value = window.localStorage.getItem(`rr-theme-${platform}`); return value === "dark" || value === "light" ? value : memoryModes[platform] ?? fallback; }
  catch { return memoryModes[platform] ?? fallback; }
}

export function PlatformThemeToggle({ platform }: { platform: Platform }) {
  const t = useTranslations("platformTheme");
  const initial = useContext(PreferencesContext)[platform];
  const mode = useSyncExternalStore(subscribe, () => savedMode(platform, initial), () => initial);

  useEffect(() => {
    document.documentElement.dataset.platform = platform;
    document.documentElement.dataset.uiTheme = mode;
  }, [platform, mode]);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    memoryModes[platform] = next;
    try { window.localStorage.setItem(`rr-theme-${platform}`, next); } catch { /* Browsers may disable storage; keep this page usable. */ }
    document.cookie = `rr_mode_${platform}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.dataset.platform = platform;
    document.documentElement.dataset.uiTheme = next;
    window.dispatchEvent(new Event(eventName));
  }

  const label = mode === "dark" ? t("switchToLight") : t("switchToDark");
  return <button className="platform-theme-toggle" type="button" onClick={toggle} aria-label={label} title={label}>
    {mode === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
    <span>{mode === "dark" ? t("light") : t("dark")}</span>
  </button>;
}
