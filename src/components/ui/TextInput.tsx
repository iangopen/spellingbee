import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

// Text field and select share one look. The edge is --edge (>=3:1 against every
// surface a field sits on, WCAG 1.4.11), never --border; the focus cue is the
// global focus ring, which is required rather than decoration because the
// resting edge is close to honey in lightness.
export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`text-input ${className}`.trim()} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`text-input ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}
