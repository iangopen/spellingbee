import type { ComponentPropsWithRef, ReactNode } from "react";

// The one button. Replaces .primary-btn, .secondary-btn, .ghost-btn,
// .danger-btn and .skip-btn (redesign stage 3).
//   primary    honey fill, marker shadow: the one thing to do on a screen
//   secondary  outlined on the panel colour
//   text       an underlined link-style action ("Skip", "Back to menu")
//   danger     outlined in the miss colour, fills on hover
// `size="sm"` is the 44px in-panel size (settings); the default is 54px.
//
// Disabled is a legible state, not a faded one: a dashed outline in muted ink,
// no fill and no shadow. Fading the primary to 50% put its label at 3.19:1,
// and the shape change also reads for someone who can't tell the two apart.
type Variant = "primary" | "secondary" | "text" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  type = "button",
  ...rest
}: {
  variant?: Variant;
  size?: "md" | "sm";
  icon?: ReactNode;
  children: ReactNode;
} & ComponentPropsWithRef<"button">) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}
