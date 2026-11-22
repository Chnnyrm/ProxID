interface LogoProps {
  className?: string
  /** Whether to render full brand color (Watermelon Pink pin with Mocha Green ridges) or monochrome */
  variant?: 'color' | 'monochrome'
}

/**
 * ProxID Logo Mark (Option A):
 * A location pin whose head contains a biometric fingerprint.
 * Represents identity inside proximity.
 */
export function Logo({ className = 'w-8 h-8', variant = 'color' }: LogoProps) {
  if (variant === 'monochrome') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ProxID Logo"
      >
        <path
          d="M32 3C18.75 3 8 13.75 8 27C8 41.5 29.2 59.5 30.7 60.7C31.5 61.4 32.5 61.4 33.3 60.7C34.8 59.5 56 41.5 56 27C56 13.75 45.25 3 32 3Z"
          fill="currentColor"
        />
        <g stroke="var(--page)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M18.5 29C18.5 20 24.2 13.5 32 13.5C39.8 13.5 45.5 20 45.5 29V33" />
          <path d="M22 32V28C22 22 26.2 17.5 32 17.5C37.8 17.5 42 22 42 28V34.5C42 37.8 39.2 40.5 36 40.5C32.8 40.5 30.2 37.8 30.2 34.5V30" />
          <path d="M25.5 34V27C25.5 23.4 28.4 21 32 21C35.6 21 38.5 23.4 38.5 27V33C38.5 35.2 36.7 37 34.5 37C32.3 37 30.5 35.2 30.5 33" />
          <path d="M29 28.5C29 26 30.3 24.2 32 24.2C33.7 24.2 35 26 35 28.5V30.5" />
          <path d="M24 38C25.5 40 27.5 41.8 29.5 42.8" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ProxID Logo"
    >
      <path
        d="M32 3C18.75 3 8 13.75 8 27C8 41.5 29.2 59.5 30.7 60.7C31.5 61.4 32.5 61.4 33.3 60.7C34.8 59.5 56 41.5 56 27C56 13.75 45.25 3 32 3Z"
        fill="#FC75B4"
        stroke="#474329"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <g stroke="#474329" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M18.5 29C18.5 20 24.2 13.5 32 13.5C39.8 13.5 45.5 20 45.5 29V33" />
        <path d="M22 32V28C22 22 26.2 17.5 32 17.5C37.8 17.5 42 22 42 28V34.5C42 37.8 39.2 40.5 36 40.5C32.8 40.5 30.2 37.8 30.2 34.5V30" />
        <path d="M25.5 34V27C25.5 23.4 28.4 21 32 21C35.6 21 38.5 23.4 38.5 27V33C38.5 35.2 36.7 37 34.5 37C32.3 37 30.5 35.2 30.5 33" />
        <path d="M29 28.5C29 26 30.3 24.2 32 24.2C33.7 24.2 35 26 35 28.5V30.5" />
        <path d="M24 38C25.5 40 27.5 41.8 29.5 42.8" />
      </g>
    </svg>
  )
}
