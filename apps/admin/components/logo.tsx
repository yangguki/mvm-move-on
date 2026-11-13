type LogoVariant = "icon" | "wordmark" | "wordmark-white" | "lockup" | "lockup-dark" | "symbol";

export function Logo({
  variant = "icon",
  height,
  size,
  radius,
}: {
  variant?: LogoVariant;
  height?: number;
  size?: number;
  radius?: number;
}) {
  const resolved = height ?? size ?? (variant.startsWith("wordmark") ? 15 : variant === "icon" ? 28 : undefined);
  const decorative = variant === "icon" || variant === "symbol";

  return (
    <img
      src={`/brand/a-v-forward-${variant}.svg`}
      alt={decorative ? "" : "MOVE ON"}
      height={resolved}
      style={{
        height: resolved,
        borderRadius: radius ?? (variant === "icon" ? 7 : undefined),
      }}
    />
  );
}
