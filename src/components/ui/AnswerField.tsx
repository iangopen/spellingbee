import { Check, X } from "lucide-react";
import type { InputHTMLAttributes, Ref } from "react";

// The typed answer, shared by RoundScreen and TurnScreen (replaces .guess-input).
// `state` colours the field and shows the tick or cross; the outcome is ALSO
// announced by the role="status" region, so the icon is decoration (aria-hidden).
// Callers keep their own readOnly / disabled rules: this adds no behaviour.
export function AnswerField({
  state,
  inputRef,
  className = "",
  ...rest
}: {
  state?: "correct" | "incorrect" | null;
  inputRef?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`field-wrap${state ? ` is-${state}` : ""}`}>
      <input ref={inputRef} className={`answer-field ${state ?? ""} ${className}`.trim()} {...rest} />
      <span className="outcome-icon ok" aria-hidden="true">
        <Check />
      </span>
      <span className="outcome-icon miss" aria-hidden="true">
        <X />
      </span>
    </div>
  );
}
