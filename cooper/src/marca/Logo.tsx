import { useId } from "react";
export function Logo({ size = 36 }: { size?: number }) {
  const reveal = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="Cooper"
      role="img"
    >
      <defs>
        <clipPath id={reveal}>
          <rect className="logo-wipe" width="48" height="48" />
        </clipPath>
      </defs>
      <path
        clipPath={`url(#${reveal})`}
        d="M35 11a18 18 0 1 0 0 26"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        className="logo-pad"
        d="M28 31c-5-1-5-5-2-8 2-3 6-3 8 0 4 3 3 7-1 8l-3-1Z"
        fill="currentColor"
      />
      <ellipse
        className="logo-toe toe-one"
        cx="23"
        cy="19"
        rx="2.4"
        ry="3"
        transform="rotate(-25 23 19)"
        fill="currentColor"
      />
      <ellipse
        className="logo-toe toe-two"
        cx="30"
        cy="16"
        rx="2.4"
        ry="3"
        fill="currentColor"
      />
      <ellipse
        className="logo-toe toe-three"
        cx="37"
        cy="19"
        rx="2.4"
        ry="3"
        transform="rotate(25 37 19)"
        fill="currentColor"
      />
    </svg>
  );
}
