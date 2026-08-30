import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "ghost";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-line-strong hover:brightness-110 active:translate-x-px active:translate-y-px active:shadow-none",
  ghost:
    "bg-surface text-ink border-line-strong hover:bg-surface-2 active:translate-x-px active:translate-y-px active:shadow-none",
};

const SIZES: Record<Size, string> = {
  md: "text-sm px-5 py-3",
  lg: "text-base px-7 py-4",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control border-[1.5px] font-semibold shadow-offset transition-[filter,transform,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type ButtonProps = { variant?: Variant; size?: Size } & (
  | ({ as?: "button" } & ComponentPropsWithoutRef<"button">)
  | ({ as: "a" } & ComponentPropsWithoutRef<"a">)
);

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  ...props
}: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (props.as === "a") {
    const { as: _as, ...anchorProps } = props;
    void _as;
    return <a className={classes} {...anchorProps} />;
  }

  const { as: _as, ...buttonProps } = props as { as?: "button" } & ComponentPropsWithoutRef<"button">;
  void _as;
  return <button className={classes} {...buttonProps} />;
}
