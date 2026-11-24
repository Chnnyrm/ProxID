/**
 * Cartoon vector illustrations in ProxID's hand-drawn minimal aesthetic:
 * - Rounded organic shapes, 2.5px thick structural strokes (#474329).
 * - Flat palette fills: Sand (#F0E5DB), Mocha (#474329), Surface (#FAF4ED).
 * - Single graphic pink touch (#FC75B4) where appropriate.
 * - Drawn by one consistent hand.
 */

interface IllustrationProps {
  className?: string
  size?: number
}

/** 1. Friendly local tradesperson with cap and wrench */
export function TradespersonIllustration({ className = 'w-24 h-24', size = 96 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cap */}
      <path
        d="M26 36C26 25 35 18 48 18C61 18 70 25 70 36H26Z"
        fill="#474329"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M68 36C74 36 78 39 80 41H64"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Cap badge - single pink graphic touch */}
      <circle cx="48" cy="27" r="4" fill="#FC75B4" stroke="#474329" strokeWidth="2" />

      {/* Head */}
      <rect
        x="32"
        y="36"
        width="32"
        height="28"
        rx="14"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />
      {/* Eyes */}
      <circle cx="42" cy="46" r="2.5" fill="#474329" />
      <circle cx="54" cy="46" r="2.5" fill="#474329" />
      {/* Smile */}
      <path
        d="M44 54C46 56 50 56 52 54"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Shoulders / Overalls */}
      <path
        d="M22 82C22 70 32 66 48 66C64 66 74 70 74 82"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Straps */}
      <path d="M36 67V82" stroke="#474329" strokeWidth="2.5" />
      <path d="M60 67V82" stroke="#474329" strokeWidth="2.5" />
      {/* Buttons */}
      <circle cx="36" cy="72" r="1.5" fill="#474329" />
      <circle cx="60" cy="72" r="1.5" fill="#474329" />
    </svg>
  )
}

/** 2. Neighborhood house / building with chimney */
export function HouseIllustration({ className = 'w-24 h-24', size = 96 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Chimney */}
      <rect
        x="60"
        y="24"
        width="10"
        height="18"
        rx="2"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />
      {/* Roof */}
      <path
        d="M18 46L48 22L78 46"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Roof trim accent */}
      <circle cx="48" cy="22" r="3.5" fill="#FC75B4" stroke="#474329" strokeWidth="2" />

      {/* House Body */}
      <rect
        x="24"
        y="46"
        width="48"
        height="36"
        rx="6"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />

      {/* Door */}
      <rect
        x="42"
        y="60"
        width="14"
        height="22"
        rx="3"
        fill="#474329"
        stroke="#474329"
        strokeWidth="2"
      />
      <circle cx="51" cy="71" r="1.5" fill="#FAF4ED" />

      {/* Window */}
      <rect
        x="30"
        y="54"
        width="8"
        height="8"
        rx="2"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2"
      />
      <rect
        x="58"
        y="54"
        width="8"
        height="8"
        rx="2"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2"
      />
    </svg>
  )
}

/** 3. Handshake / Concordium Human Vouch agreement */
export function HandshakeIllustration({ className = 'w-24 h-24', size = 96 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background seal badge */}
      <circle
        cx="48"
        cy="48"
        r="34"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Left Hand / Sleeve */}
      <path
        d="M20 54L34 44L44 54L36 62L20 54Z"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Right Hand / Sleeve */}
      <path
        d="M76 54L62 44L52 54L60 62L76 54Z"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Clasp center */}
      <path
        d="M40 50C44 46 52 46 56 50L48 58L40 50Z"
        fill="#474329"
        stroke="#474329"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Verification Shield Stamp */}
      <path
        d="M48 24C48 24 54 26 57 28V36C57 41 53 45 48 47C43 45 39 41 39 36V28C42 26 48 24 48 24Z"
        fill="#FC75B4"
        stroke="#474329"
        strokeWidth="2"
      />
      <path
        d="M44 35L47 38L52 32"
        stroke="#1C1B12"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 4. Friendly cartoon agent character for proxidAI */
export function AgentCharacterIllustration({ className = 'w-24 h-24', size = 96 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Antenna */}
      <line x1="48" y1="14" x2="48" y2="24" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="12" r="4" fill="#FC75B4" stroke="#474329" strokeWidth="2" />

      {/* Robot Head Frame */}
      <rect
        x="24"
        y="24"
        width="48"
        height="40"
        rx="12"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />

      {/* Screen Inset */}
      <rect
        x="32"
        y="32"
        width="32"
        height="24"
        rx="6"
        fill="#474329"
        stroke="#474329"
        strokeWidth="2"
      />

      {/* Friendly Eyes */}
      <circle cx="41" cy="43" r="3" fill="#FAF4ED" />
      <circle cx="55" cy="43" r="3" fill="#FAF4ED" />
      {/* Smile */}
      <path d="M45 49C46 51 50 51 51 49" stroke="#FAF4ED" strokeWidth="2" strokeLinecap="round" />

      {/* Ear nodes */}
      <rect x="18" y="38" width="6" height="12" rx="3" fill="#474329" />
      <rect x="72" y="38" width="6" height="12" rx="3" fill="#474329" />

      {/* Body torso */}
      <rect
        x="30"
        y="68"
        width="36"
        height="16"
        rx="6"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />
      <circle cx="48" cy="76" r="3" fill="#474329" />
    </svg>
  )
}

/** 5. Payment token / x402 settlement coin */
export function PaymentTokenIllustration({ className = 'w-24 h-24', size = 96 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Coin Outer Rim */}
      <circle
        cx="48"
        cy="48"
        r="32"
        fill="#FAF4ED"
        stroke="#474329"
        strokeWidth="2.5"
      />
      {/* Inner Rim */}
      <circle
        cx="48"
        cy="48"
        r="24"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      {/* Center Shield / Token Icon */}
      <path
        d="M48 34L58 39V48C58 54 53 59 48 61C43 59 38 54 38 48V39L48 34Z"
        fill="#474329"
        stroke="#474329"
        strokeWidth="2"
      />
      <circle cx="48" cy="48" r="3" fill="#FC75B4" />
    </svg>
  )
}
