"use client";

import { useState } from "react";
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

  return <div className="login-input-control">
    <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} minLength={minLength} maxLength={maxLength} />
    <button className="visibility-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} aria-controls={id} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>;
}
