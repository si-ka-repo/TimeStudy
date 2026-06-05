import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant?: "default" | "info" | "inProgress" | "inProgressActive";
  style?: CSSProperties;
};

export function Card({ children, variant = "default", className = "", style, ...rest }: CardProps) {
  const classes = ["ui-card", variant !== "default" ? `ui-card--${variant}` : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} style={style} {...rest}>
      {children}
    </section>
  );
}
