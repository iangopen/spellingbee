import type { ElementType, HTMLAttributes, ReactNode } from "react";

// A lit, hand-outlined surface: the ONE card style (there is no second). Text
// goes on a Panel, never on the bare honeycomb. The drawn outline is a
// pseudo-element wobbled by the #hm-wobble-s filter, which <WobbleFilters />
// mounts once in Shell.
export function Panel({
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: { as?: ElementType; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`panel ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/** A small tilted badge hanging off a panel's edge. Decorative: aria-hidden. */
export function Sticker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`sticker ${className}`.trim()} aria-hidden="true">
      {children}
    </span>
  );
}

/** "4 of 10 words": the contestant's placard. */
export function Placard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="placard">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
