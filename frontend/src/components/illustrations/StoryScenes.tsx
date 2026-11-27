/**
 * StoryScenes.tsx - 8 Paper-craft vector cartoon scenes featuring Amaka, Tunde, and proxidAI.
 * Aesthetic: layered cut shapes, visible 2.5px edges (#474329), soft drop shadows,
 * Sand (#F0E5DB), Mocha (#474329), Surface (#FAF4ED), Watermelon (#FC75B4).
 * Pure ASCII only.
 */

interface SceneProps {
  className?: string
  width?: number
  height?: number
}

/** Scene 1: Amaka needs a plumber today (map, radius, leaking tap) */
export function Scene1AmakaNeedsPlumber({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1: Background paper room */}
      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow)" />

      {/* Map card with radius circle */}
      <g filter="url(#paper-shadow)">
        <rect x="175" y="35" width="150" height="150" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        {/* Map grid streets */}
        <path d="M190 70H310 M190 120H310 M230 45V170 M275 45V170" stroke="#474329" strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="3 3" />
        {/* Radius circle */}
        <circle cx="250" cy="110" r="42" fill="#FC75B4" fillOpacity="0.15" stroke="#FC75B4" strokeWidth="2" strokeDasharray="4 3" />
        {/* Amaka center pin */}
        <circle cx="250" cy="110" r="6" fill="#474329" />
        <circle cx="250" cy="110" r="2.5" fill="#FAF4ED" />
        {/* Plumber pin within radius */}
        <circle cx="270" cy="95" r="5" fill="#FC75B4" stroke="#474329" strokeWidth="1.5" />
        <rect x="235" y="160" width="80" height="18" rx="6" fill="#474329" />
        <text x="275" y="172" fill="#FAF4ED" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">RADIUS: 5 KM</text>
      </g>

      {/* Amaka figure */}
      <g filter="url(#paper-shadow)">
        {/* Body / dress */}
        <path d="M50 175C50 140 70 130 95 130C120 130 140 140 140 175H50Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Hair braids */}
        <ellipse cx="95" cy="85" rx="28" ry="26" fill="#474329" />
        {/* Face */}
        <rect x="75" y="70" width="40" height="38" rx="19" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Eyes & Smile */}
        <circle cx="87" cy="85" r="2.5" fill="#474329" />
        <circle cx="103" cy="85" r="2.5" fill="#474329" />
        <path d="M90 98C93 94 97 94 100 98" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        {/* Hair bun with pink hairband */}
        <circle cx="95" cy="55" r="14" fill="#474329" />
        <ellipse cx="95" cy="65" rx="8" ry="3" fill="#FC75B4" stroke="#474329" strokeWidth="1.5" />
      </g>

      {/* Leaking pipe & drip */}
      <path d="M25 45H55V65" stroke="#474329" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 70V80" stroke="#FC75B4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="55" cy="92" r="3" fill="#FC75B4" />
    </svg>
  )
}

/** Scene 2: Trust and Verified badge (Concordium ZKP) */
export function Scene2TrustAndVerified({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-2" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-2)" />

      {/* Contractor card inspected */}
      <g filter="url(#paper-shadow-2)">
        <rect x="40" y="40" width="160" height="140" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Avatar sketch */}
        <circle cx="80" cy="75" r="20" fill="#F0E5DB" stroke="#474329" strokeWidth="2" />
        <circle cx="80" cy="72" r="8" fill="#474329" />
        <path d="M68 90C68 83 74 81 80 81C86 81 92 83 92 90" stroke="#474329" strokeWidth="2" />

        {/* Text lines */}
        <rect x="110" y="65" width="70" height="8" rx="4" fill="#474329" />
        <rect x="110" y="78" width="50" height="6" rx="3" fill="#474329" fillOpacity="0.4" />
        <rect x="60" y="112" width="120" height="5" rx="2.5" fill="#474329" fillOpacity="0.3" />
        <rect x="60" y="123" width="90" height="5" rx="2.5" fill="#474329" fillOpacity="0.3" />

        {/* Verified Badge pill */}
        <rect x="60" y="142" width="120" height="22" rx="6" fill="#FAF4ED" stroke="#474329" strokeWidth="1.5" />
        <circle cx="72" cy="153" r="6" fill="#FC75B4" />
        <text x="83" y="156" fill="#474329" fontSize="8" fontFamily="sans-serif" fontWeight="bold">CONCORDIUM VERIFIED</text>
      </g>

      {/* Large Glowing Concordium Shield with Fingerprint Icon */}
      <g filter="url(#paper-shadow-2)">
        <path d="M260 45L305 60V110C305 140 260 165 260 165C260 165 215 140 215 110V60L260 45Z" fill="#FAF4ED" stroke="#474329" strokeWidth="3" />
        <path d="M260 55L295 68V110C295 133 260 153 260 153C260 153 225 133 225 110V68L260 55Z" fill="#FC75B4" fillOpacity="0.2" />
        {/* Shield check mark */}
        <path d="M245 105L255 115L278 92" stroke="#474329" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="220" y="176" width="80" height="16" rx="6" fill="#474329" />
        <text x="260" y="187" fill="#FAF4ED" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">ZERO KNOWLEDGE</text>
      </g>
    </svg>
  )
}

/** Scene 3: Voice Scout proxidAI */
export function Scene3VoiceScout({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-3" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-3)" />

      {/* Amaka speaking on left */}
      <g filter="url(#paper-shadow-3)">
        <path d="M40 180C40 150 55 140 75 140C95 140 110 150 110 180H40Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="75" cy="105" r="22" fill="#474329" />
        <rect x="58" y="92" width="34" height="32" rx="16" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="68" cy="105" r="2" fill="#474329" />
        <circle cx="82" cy="105" r="2" fill="#474329" />
        {/* Speaking mouth */}
        <ellipse cx="75" cy="116" rx="3" ry="2" fill="#474329" />
      </g>

      {/* Speech waves to mic */}
      <path d="M105 105C115 100 115 120 125 110" stroke="#FC75B4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M120 95C132 90 132 130 144 115" stroke="#FC75B4" strokeWidth="2.5" strokeLinecap="round" />

      {/* Prominent Microphone */}
      <g filter="url(#paper-shadow-3)">
        <rect x="155" y="80" width="36" height="52" rx="18" fill="#FC75B4" stroke="#474329" strokeWidth="2.5" />
        <path d="M147 106C147 122 199 122 199 106" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M173 125V145" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="160" y="145" width="26" height="6" rx="3" fill="#474329" />
      </g>

      {/* Robot proxidAI listening on right */}
      <g filter="url(#paper-shadow-3)">
        <rect x="235" y="70" width="85" height="95" rx="18" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Robot antenna */}
        <path d="M277 70V52" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="277" cy="48" r="5" fill="#FC75B4" stroke="#474329" strokeWidth="2" />
        {/* Robot screen / visor */}
        <rect x="247" y="88" width="61" height="32" rx="10" fill="#474329" />
        {/* Friendly eyes on screen */}
        <circle cx="264" cy="104" r="4" fill="#FC75B4" />
        <circle cx="291" cy="104" r="4" fill="#FC75B4" />
        {/* Structured badge output */}
        <rect x="245" y="132" width="65" height="18" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="277" y="144" fill="#474329" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">FIND PLUMBER</text>
      </g>
    </svg>
  )
}

/** Scene 4: Tunde has a van and wants work */
export function Scene4TundeWithVan({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-4" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-4)" />

      {/* Service Van */}
      <g filter="url(#paper-shadow-4)">
        {/* Van body */}
        <path d="M120 145H295V100C295 90 285 85 275 85H215L190 100H120V145Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Van windshield */}
        <path d="M193 100L213 88H235V105H185L193 100Z" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        {/* Van wheels */}
        <circle cx="155" cy="150" r="14" fill="#474329" />
        <circle cx="155" cy="150" r="5" fill="#FAF4ED" />
        <circle cx="260" cy="150" r="14" fill="#474329" />
        <circle cx="260" cy="150" r="5" fill="#FAF4ED" />
        {/* Logo stripe on van */}
        <rect x="220" y="115" width="60" height="12" rx="4" fill="#FC75B4" />
        <text x="250" y="124" fill="#474329" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">TUNDE PLUMBING</text>
      </g>

      {/* Tunde tradesperson on left */}
      <g filter="url(#paper-shadow-4)">
        {/* Cap */}
        <path d="M45 78C45 68 53 62 65 62C77 62 85 68 85 78H45Z" fill="#474329" stroke="#474329" strokeWidth="2" />
        <path d="M83 78C88 78 92 80 94 82H80" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        {/* Face */}
        <rect x="50" y="78" width="30" height="28" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="58" cy="88" r="2" fill="#474329" />
        <circle cx="72" cy="88" r="2" fill="#474329" />
        <path d="M60 96C63 98 67 98 70 96" stroke="#474329" strokeWidth="1.5" strokeLinecap="round" />
        {/* Body with overalls */}
        <path d="M35 170C35 125 50 115 65 115C80 115 95 125 95 170H35Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <rect x="52" y="125" width="26" height="30" rx="4" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        {/* Wrench in hand */}
        <path d="M92 135L108 118" stroke="#474329" strokeWidth="4" strokeLinecap="round" />
        <circle cx="110" cy="116" r="5" stroke="#474329" strokeWidth="2.5" fill="#FAF4ED" />
      </g>

      {/* Incoming job card match with Apply Button */}
      <g filter="url(#paper-shadow-4)">
        <rect x="180" y="30" width="135" height="46" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="190" y="44" fill="#474329" fontSize="8" fontWeight="bold">FIX PIPE // IKOYI</text>
        <text x="190" y="55" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace">NGN 15,000 &bull; 2.1 KM</text>
        <rect x="260" y="38" width="45" height="22" rx="6" fill="#474329" />
        <text x="282" y="52" fill="#FAF4ED" fontSize="8" fontWeight="bold" textAnchor="middle">APPLY</text>
      </g>
    </svg>
  )
}

/** Scene 5: Money held in Escrow */
export function Scene5EscrowSecurity({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-5" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-5)" />

      {/* Amaka on left */}
      <g filter="url(#paper-shadow-5)">
        <circle cx="65" cy="85" r="18" fill="#474329" />
        <rect x="51" y="74" width="28" height="26" rx="13" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M40 165C40 130 52 120 65 120C78 120 90 130 90 165H40Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="65" y="180" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">CLIENT</text>
      </g>

      {/* Central Escrow Vault Lock */}
      <g filter="url(#paper-shadow-5)">
        <rect x="135" y="65" width="90" height="85" rx="16" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Shackle */}
        <path d="M160 65V48C160 38 200 38 200 48V65" stroke="#474329" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Keyhole & vault ring */}
        <circle cx="180" cy="102" r="18" fill="#FC75B4" fillOpacity="0.25" stroke="#FC75B4" strokeWidth="2" />
        <circle cx="180" cy="100" r="5" fill="#474329" />
        <path d="M180 104V113" stroke="#474329" strokeWidth="3" strokeLinecap="round" />
        <rect x="145" y="130" width="70" height="14" rx="4" fill="#474329" />
        <text x="180" y="140" fill="#FAF4ED" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">ESCROW LOCKED</text>
      </g>

      {/* Tunde on right */}
      <g filter="url(#paper-shadow-5)">
        <path d="M282 72C282 64 288 60 297 60C306 60 312 64 312 72H282Z" fill="#474329" />
        <rect x="284" y="72" width="26" height="24" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M272 165C272 130 284 120 297 120C310 120 322 130 322 165H272Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="297" y="180" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">PROVIDER</text>
      </g>

      {/* Arrows pointing into escrow */}
      <path d="M98 105H125" stroke="#474329" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M262 105H235" stroke="#474329" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  )
}

/** Scene 6: Payment settles on Concordium (x402 receipt) */
export function Scene6ConcordiumSettlement({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-6" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-6)" />

      {/* Receipt Paper slip */}
      <g filter="url(#paper-shadow-6)">
        <rect x="75" y="32" width="210" height="155" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Jagged bottom or header */}
        <rect x="95" y="48" width="170" height="24" rx="6" fill="#474329" />
        <text x="180" y="63" fill="#FAF4ED" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">X402 CONCORDIUM RECEIPT</text>

        {/* Checkmark circle */}
        <circle cx="115" cy="98" r="14" fill="#FC75B4" />
        <path d="M109 98L113 102L122 93" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Receipt lines */}
        <text x="140" y="94" fill="#474329" fontSize="9" fontWeight="bold">SETTLEMENT COMPLETE</text>
        <text x="140" y="106" fill="#474329" fillOpacity="0.6" fontSize="8" fontFamily="monospace">TX: 4221332d...f027</text>

        <path d="M95 125H265" stroke="#474329" strokeWidth="1.5" strokeDasharray="4 3" />

        <text x="95" y="145" fill="#474329" fontSize="9">Amount Paid:</text>
        <text x="265" y="145" fill="#474329" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">NGN 15,000</text>

        <text x="95" y="162" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace">DIRECT PEER-TO-PEER // 0% INTERMEDIARY</text>
      </g>
    </svg>
  )
}

/** Scene 7: Zero-Knowledge Identity (Prove without showing) */
export function Scene7ZeroKnowledgeIdentity({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-7" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-7)" />

      {/* Hidden passport card on left (blurred / redacted) */}
      <g filter="url(#paper-shadow-7)">
        <rect x="40" y="50" width="110" height="120" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <rect x="52" y="62" width="40" height="40" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        {/* Redacted privacy bars */}
        <rect x="52" y="112" width="86" height="8" rx="4" fill="#474329" />
        <rect x="52" y="125" width="70" height="8" rx="4" fill="#474329" />
        <rect x="52" y="138" width="55" height="8" rx="4" fill="#474329" />
        {/* Eye crossed / private badge */}
        <rect x="48" y="42" width="75" height="16" rx="4" fill="#474329" />
        <text x="85" y="53" fill="#FAF4ED" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">PRIVATE DATA</text>
      </g>

      {/* ZK Proof transformation arrow */}
      <path d="M165 110H200" stroke="#FC75B4" strokeWidth="3" strokeDasharray="4 3" />
      <polygon points="205,110 197,105 197,115" fill="#FC75B4" />

      {/* What the world sees: clean verified mark */}
      <g filter="url(#paper-shadow-7)">
        <rect x="215" y="50" width="105" height="120" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="267" cy="95" r="24" fill="#FC75B4" fillOpacity="0.2" stroke="#FC75B4" strokeWidth="2" />
        <circle cx="267" cy="95" r="14" fill="#474329" />
        <path d="M261 95L265 99L274 90" stroke="#FAF4ED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="267" y="138" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">VERIFIED HUMAN</text>
        <text x="267" y="148" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace" textAnchor="middle">NO ID LEAKED</text>
      </g>
    </svg>
  )
}

/** Scene 8: The agent asks before it spends (Guard Cap & Article 12 audit) */
export function Scene8AgentConsentGuards({ className = 'w-full h-auto max-w-sm', width = 360, height = 220 }: SceneProps) {
  return (
    <svg viewBox="0 0 360 220" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="paper-shadow-8" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect x="15" y="15" width="330" height="190" rx="16" fill="#F0E5DB" stroke="#474329" strokeWidth="2.5" filter="url(#paper-shadow-8)" />

      {/* proxidAI holding dialog banner */}
      <g filter="url(#paper-shadow-8)">
        {/* Robot scout */}
        <rect x="40" y="65" width="60" height="65" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M70 65V50" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="46" r="4" fill="#FC75B4" />
        <rect x="48" y="78" width="44" height="22" rx="8" fill="#474329" />
        <circle cx="60" cy="89" r="3" fill="#FC75B4" />
        <circle cx="80" cy="89" r="3" fill="#FC75B4" />
      </g>

      {/* Consent Dialog Box */}
      <g filter="url(#paper-shadow-8)">
        <rect x="120" y="42" width="200" height="135" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        {/* Cap badge */}
        <rect x="135" y="55" width="170" height="20" rx="5" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="220" y="68" fill="#474329" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">SPEND GUARD // CAP: NGN 10,000</text>

        {/* Message from agent */}
        <text x="135" y="92" fill="#474329" fontSize="9" fontWeight="bold">Authorize Milestone Release?</text>
        <text x="135" y="105" fill="#474329" fillOpacity="0.7" fontSize="8">Tunde completed the pipe repair.</text>

        {/* Action Buttons: Cancel vs Approve */}
        <rect x="135" y="122" width="70" height="26" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="170" y="138" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">Reject</text>

        <rect x="215" y="122" width="90" height="26" rx="6" fill="#474329" />
        <text x="260" y="138" fill="#FAF4ED" fontSize="8" fontWeight="bold" textAnchor="middle">Approve (x402)</text>

        <text x="220" y="166" fill="#474329" fillOpacity="0.5" fontSize="7" fontFamily="monospace" textAnchor="middle">ARTICLE 12 AUDIT TRAIL LOGGED</text>
      </g>
    </svg>
  )
}
