"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export function PasswordInput({ id, name, autoComplete, required = true, minLength, maxLength = 1024 }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("auth");

  return <div className="login-input-control">
    <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} minLength={minLength} maxLength={maxLength} />
    <button className="visibility-toggle" type="button" aria-label={visible ? t("hidePassword") : t("showPassword")} title={visible ? t("hidePassword") : t("showPassword")} aria-controls={id} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>;
}
