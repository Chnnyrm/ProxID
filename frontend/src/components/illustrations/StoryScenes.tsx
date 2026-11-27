/**
 * StoryScenes.tsx - 8 Paper-craft vector cartoon scenes featuring Amaka, Tunde, and proxidAI.
 * Aesthetic: layered cut shapes, visible 2.5px edges (#474329), soft drop shadows,
 * Sand (#F0E5DB), Mocha (#474329), Surface (#FAF4ED), Watermelon (#FC75B4).
 * Pure ASCII only.
 *
 * Implements framer-motion choreography:
 * - Staggered entrance: ground (0ms), background prop (+80ms), character (+80ms), focal (+80ms).
 * - Cut-paper physics: drop shadows, settle bounce, hover tilt, press scale 0.98.
 * - Directional paper pointer in every scene.
 * - Subtle watermelon pink ring pulse (#FC75B4) on key concepts.
 * - Respects prefers-reduced-motion: clean cross-fade without bounce/tilt.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface SceneProps {
  className?: string
  width?: number
  height?: number
  isPlaying?: boolean
}

const paperEase = [0.2, 0.9, 0.3, 1] as const

/** Directional paper arrow that slides into frame pointing at the focal element */
function PaperPointer({
  x,
  y,
  angle = 0,
  label,
  delay = 0.32,
  reduced = false,
}: {
  x: number
  y: number
  angle?: number
  label?: string
  delay?: number
  reduced?: boolean
}) {
  if (reduced) {
    return (
      <g transform={`translate(${x}, ${y}) rotate(${angle})`}>
        <polygon points="0,0 -16,-8 -12,0 -16,8" fill="#FC75B4" stroke="#474329" strokeWidth="1.5" />
      </g>
    )
  }

  return (
    <motion.g
      initial={{ opacity: 0, x: x - 18, y: y }}
      animate={{ opacity: 1, x, y }}
      transition={{ delay, duration: 0.4, ease: paperEase }}
      className="pointer-events-none"
    >
      <g transform={`rotate(${angle})`}>
        {/* Paper folded arrow */}
        <polygon
          points="0,0 -20,-10 -15,0 -20,10"
          fill="#FAF4ED"
          stroke="#474329"
          strokeWidth="2"
        />
        <polygon points="-15,0 -20,-10 0,0" fill="#FC75B4" fillOpacity="0.8" />
        {label && (
          <text
            x="-24"
            y="3"
            fill="#474329"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="end"
          >
            {label}
          </text>
        )}
      </g>
    </motion.g>
  )
}

/** Pink pulse ring that expands and fades at 25% opacity */
function PinkPulse({
  cx,
  cy,
  r = 16,
  delay = 0.4,
  reduced = false,
}: {
  cx: number
  cy: number
  r?: number
  delay?: number
  reduced?: boolean
}) {
  if (reduced) return null

  return (
    <motion.circle
      cx={cx}
      cy={cy}
      initial={{ r, opacity: 0.6 }}
      animate={{ r: r * 2.2, opacity: [0.6, 0.25, 0] }}
      transition={{
        delay,
        duration: 1.4,
        repeat: Infinity,
        repeatDelay: 2.2,
        ease: 'easeOut',
      }}
      fill="none"
      stroke="#FC75B4"
      strokeWidth="2.5"
    />
  )
}

/** Scene 1: Amaka needs a plumber today (map, radius, leaking tap) */
export function Scene1AmakaNeedsPlumber({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 1: Local Discovery"
      whileHover={shouldReduce ? undefined : { rotate: 0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-1" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground): Paper room */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-1)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Prop): Leaking pipe & drip */}
      <motion.g
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <path d="M25 45H55V65" stroke="#474329" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M55 70V80" stroke="#FC75B4" strokeWidth="3" strokeLinecap="round" />
        <motion.circle
          cx="55"
          cy="92"
          r="3.5"
          fill="#FC75B4"
          animate={shouldReduce ? undefined : { y: [0, 8, 0], opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        />
      </motion.g>

      {/* Layer 3 (Character): Amaka figure */}
      <motion.g
        filter="url(#paper-shadow-1)"
        initial={shouldReduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.4, ease: paperEase }}
      >
        <path d="M50 175C50 140 70 130 95 130C120 130 140 140 140 175H50Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <ellipse cx="95" cy="85" rx="28" ry="26" fill="#474329" />
        <rect x="75" y="70" width="40" height="38" rx="19" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <circle cx="87" cy="85" r="2.5" fill="#474329" />
        <circle cx="103" cy="85" r="2.5" fill="#474329" />
        <path d="M90 98C93 94 97 94 100 98" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        <circle cx="95" cy="55" r="14" fill="#474329" />
        <ellipse cx="95" cy="65" rx="8" ry="3" fill="#FC75B4" stroke="#474329" strokeWidth="1.5" />
      </motion.g>

      {/* Layer 4 (Focal): Map Card with radius and animated pins */}
      <motion.g
        filter="url(#paper-shadow-1)"
        initial={shouldReduce ? false : { opacity: 0, y: 25, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.24, duration: 0.45, ease: paperEase }}
      >
        <rect x="175" y="35" width="150" height="150" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M190 70H310 M190 120H310 M230 45V170 M275 45V170" stroke="#474329" strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="3 3" />

        {/* Radius circle draws outward from center */}
        <motion.circle
          cx="250"
          cy="110"
          r="42"
          fill="#FC75B4"
          fillOpacity="0.15"
          stroke="#FC75B4"
          strokeWidth="2"
          strokeDasharray="4 3"
          initial={shouldReduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: paperEase }}
          style={{ originX: '250px', originY: '110px' }}
        />

        {/* Amaka center pin drops into place with tiny bounce */}
        <motion.g
          initial={shouldReduce ? false : { y: -25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.48, type: 'spring', damping: 12, stiffness: 200 }}
        >
          <circle cx="250" cy="110" r="7" fill="#474329" />
          <circle cx="250" cy="110" r="3" fill="#FAF4ED" />
        </motion.g>

        {/* Plumber pin drops into place with tiny bounce */}
        <motion.g
          initial={shouldReduce ? false : { y: -25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', damping: 12, stiffness: 200 }}
        >
          <circle cx="270" cy="95" r="6" fill="#FC75B4" stroke="#474329" strokeWidth="1.5" />
          <circle cx="270" cy="95" r="2" fill="#FAF4ED" />
        </motion.g>

        <rect x="235" y="160" width="80" height="18" rx="6" fill="#474329" />
        <text x="275" y="172" fill="#FAF4ED" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          RADIUS: 5 KM
        </text>
      </motion.g>

      {/* Directional Paper Pointer pointing to plumber pin */}
      <PaperPointer x={294} y={88} angle={-15} label="TUNDE" delay={0.7} reduced={shouldReduce} />

      {/* Subtle Pink Pulse on plumber pin */}
      <PinkPulse cx={270} cy={95} r={8} delay={0.8} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 2: Trust and Verified badge (Concordium ZKP) */
export function Scene2TrustAndVerified({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 2: Proven Identity"
      whileHover={shouldReduce ? undefined : { rotate: -0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-2" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-2)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Background Prop): Contractor card */}
      <motion.g
        filter="url(#paper-shadow-2)"
        initial={shouldReduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <rect x="40" y="40" width="160" height="140" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <circle cx="80" cy="75" r="20" fill="#F0E5DB" stroke="#474329" strokeWidth="2" />
        <circle cx="80" cy="72" r="8" fill="#474329" />
        <path d="M68 90C68 83 74 81 80 81C86 81 92 83 92 90" stroke="#474329" strokeWidth="2" />
        <rect x="110" y="65" width="70" height="8" rx="4" fill="#474329" />
        <rect x="110" y="78" width="50" height="6" rx="3" fill="#474329" fillOpacity="0.4" />
        <rect x="60" y="112" width="120" height="5" rx="2.5" fill="#474329" fillOpacity="0.3" />
        <rect x="60" y="123" width="90" height="5" rx="2.5" fill="#474329" fillOpacity="0.3" />

        {/* Verified Badge pill */}
        <rect x="60" y="142" width="120" height="22" rx="6" fill="#FAF4ED" stroke="#474329" strokeWidth="1.5" />
        <circle cx="72" cy="153" r="6" fill="#FC75B4" />
        <text x="83" y="156" fill="#474329" fontSize="8" fontFamily="sans-serif" fontWeight="bold">
          CONCORDIUM VERIFIED
        </text>
      </motion.g>

      {/* Layer 3 & 4 (Focal): Concordium shield slides down & verified stamp slams down */}
      <motion.g
        filter="url(#paper-shadow-2)"
        initial={shouldReduce ? false : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: paperEase }}
      >
        <path d="M260 45L305 60V110C305 140 260 165 260 165C260 165 215 140 215 110V60L260 45Z" fill="#FAF4ED" stroke="#474329" strokeWidth="3" />
        <path d="M260 55L295 68V110C295 133 260 153 260 153C260 153 225 133 225 110V68L260 55Z" fill="#FC75B4" fillOpacity="0.2" />

        {/* Verified stamp slams down with spring */}
        <motion.path
          d="M245 105L255 115L278 92"
          stroke="#474329"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={shouldReduce ? false : { scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45, type: 'spring', damping: 14, stiffness: 220 }}
          style={{ originX: '260px', originY: '105px' }}
        />

        <rect x="220" y="176" width="80" height="16" rx="6" fill="#474329" />
        <text x="260" y="187" fill="#FAF4ED" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          ZERO KNOWLEDGE
        </text>
      </motion.g>

      {/* Directional Paper Pointer */}
      <PaperPointer x={212} y={110} angle={0} label="PROVED" delay={0.65} reduced={shouldReduce} />

      {/* Pink Pulse ring */}
      <PinkPulse cx={260} cy={105} r={22} delay={0.6} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 3: Voice Scout proxidAI */
export function Scene3VoiceScout({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 3: Voice Scout"
      whileHover={shouldReduce ? undefined : { rotate: 1.0 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-3" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-3)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Character): Amaka speaking */}
      <motion.g
        filter="url(#paper-shadow-3)"
        initial={shouldReduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <path d="M40 180C40 150 55 140 75 140C95 140 110 150 110 180H40Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="75" cy="105" r="22" fill="#474329" />
        <rect x="58" y="92" width="34" height="32" rx="16" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="68" cy="105" r="2" fill="#474329" />
        <circle cx="82" cy="105" r="2" fill="#474329" />
        <ellipse cx="75" cy="116" rx="3" ry="2" fill="#474329" />
      </motion.g>

      {/* Concentric soundwaves pulsing from voice to mic */}
      <motion.path
        d="M105 105C115 100 115 120 125 110"
        stroke="#FC75B4"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={shouldReduce ? false : { opacity: 0, scale: 0.8 }}
        animate={shouldReduce ? undefined : { opacity: [0, 1, 0], scale: [0.8, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, delay: 0.3 }}
      />
      <motion.path
        d="M120 95C132 90 132 130 144 115"
        stroke="#FC75B4"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={shouldReduce ? false : { opacity: 0, scale: 0.8 }}
        animate={shouldReduce ? undefined : { opacity: [0, 1, 0], scale: [0.8, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, delay: 0.5 }}
      />

      {/* Layer 3 (Focal): Prominent Microphone */}
      <motion.g
        filter="url(#paper-shadow-3)"
        initial={shouldReduce ? false : { opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.45, ease: paperEase }}
      >
        <rect x="155" y="80" width="36" height="52" rx="18" fill="#FC75B4" stroke="#474329" strokeWidth="2.5" />
        <path d="M147 106C147 122 199 122 199 106" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M173 125V145" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="160" y="145" width="26" height="6" rx="3" fill="#474329" />
      </motion.g>

      {/* Layer 4: Robot proxidAI with eye blink */}
      <motion.g
        filter="url(#paper-shadow-3)"
        initial={shouldReduce ? false : { opacity: 0, x: 25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.24, duration: 0.45, ease: paperEase }}
      >
        <rect x="235" y="70" width="85" height="95" rx="18" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <path d="M277 70V52" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="277" cy="48" r="5" fill="#FC75B4" stroke="#474329" strokeWidth="2" />
        <rect x="247" y="88" width="61" height="32" rx="10" fill="#474329" />

        {/* Robot eyes with blink animation */}
        <motion.circle
          cx="264"
          cy="104"
          r="4"
          fill="#FC75B4"
          animate={shouldReduce ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.3 }}
          style={{ originY: '104px' }}
        />
        <motion.circle
          cx="291"
          cy="104"
          r="4"
          fill="#FC75B4"
          animate={shouldReduce ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.3 }}
          style={{ originY: '104px' }}
        />

        <rect x="245" y="132" width="65" height="18" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="277" y="144" fill="#474329" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          FIND PLUMBER
        </text>
      </motion.g>

      {/* Directional Paper Pointer pointing to Mic */}
      <PaperPointer x={148} y={106} angle={180} label="VOICE" delay={0.6} reduced={shouldReduce} />

      {/* Pink Pulse on Mic */}
      <PinkPulse cx={173} cy={106} r={24} delay={0.5} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 4: Tunde has a van and wants work */
export function Scene4TundeWithVan({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 4: Matching Work"
      whileHover={shouldReduce ? undefined : { rotate: -0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-4" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-4)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Prop): Service Van */}
      <motion.g
        filter="url(#paper-shadow-4)"
        initial={shouldReduce ? false : { opacity: 0, x: 25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: paperEase }}
      >
        <path d="M120 145H295V100C295 90 285 85 275 85H215L190 100H120V145Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <path d="M193 100L213 88H235V105H185L193 100Z" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <circle cx="155" cy="150" r="14" fill="#474329" />
        <circle cx="155" cy="150" r="5" fill="#FAF4ED" />
        <circle cx="260" cy="150" r="14" fill="#474329" />
        <circle cx="260" cy="150" r="5" fill="#FAF4ED" />
        <rect x="220" y="115" width="60" height="12" rx="4" fill="#FC75B4" />
        <text x="250" y="124" fill="#474329" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          TUNDE PLUMBING
        </text>
      </motion.g>

      {/* Layer 3 (Character): Tunde tradesperson */}
      <motion.g
        filter="url(#paper-shadow-4)"
        initial={shouldReduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.16, duration: 0.45, ease: paperEase }}
      >
        <path d="M45 78C45 68 53 62 65 62C77 62 85 68 85 78H45Z" fill="#474329" stroke="#474329" strokeWidth="2" />
        <path d="M83 78C88 78 92 80 94 82H80" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        <rect x="50" y="78" width="30" height="28" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="58" cy="88" r="2" fill="#474329" />
        <circle cx="72" cy="88" r="2" fill="#474329" />
        <path d="M60 96C63 98 67 98 70 96" stroke="#474329" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M35 170C35 125 50 115 65 115C80 115 95 125 95 170H35Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <rect x="52" y="125" width="26" height="30" rx="4" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <path d="M92 135L108 118" stroke="#474329" strokeWidth="4" strokeLinecap="round" />
        <circle cx="110" cy="116" r="5" stroke="#474329" strokeWidth="2.5" fill="#FAF4ED" />
      </motion.g>

      {/* Layer 4 (Focal): Job card flies in from right and lands */}
      <motion.g
        filter="url(#paper-shadow-4)"
        initial={shouldReduce ? false : { opacity: 0, x: 60, y: -20, rotate: 6 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        transition={{ delay: 0.3, duration: 0.55, ease: paperEase }}
      >
        <rect x="180" y="30" width="135" height="46" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="190" y="44" fill="#474329" fontSize="8" fontWeight="bold">
          FIX PIPE // IKOYI
        </text>
        <text x="190" y="55" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace">
          NGN 15,000 &bull; 2.1 KM
        </text>
        <rect x="260" y="38" width="45" height="22" rx="6" fill="#474329" />
        <text x="282" y="52" fill="#FAF4ED" fontSize="8" fontWeight="bold" textAnchor="middle">
          APPLY
        </text>
      </motion.g>

      {/* Directional Paper Pointer pointing to Job card */}
      <PaperPointer x={170} y={53} angle={0} label="MATCH" delay={0.65} reduced={shouldReduce} />

      {/* Pink Pulse ring */}
      <PinkPulse cx={282} cy={49} r={14} delay={0.7} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 5: Money held in Escrow */
export function Scene5EscrowSecurity({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 5: Escrow Security"
      whileHover={shouldReduce ? undefined : { rotate: 0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-5" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-5)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Characters): Amaka on left, Tunde on right */}
      <motion.g
        filter="url(#paper-shadow-5)"
        initial={shouldReduce ? false : { opacity: 0, x: -15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <circle cx="65" cy="85" r="18" fill="#474329" />
        <rect x="51" y="74" width="28" height="26" rx="13" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M40 165C40 130 52 120 65 120C78 120 90 130 90 165H40Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="65" y="180" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">
          CLIENT
        </text>
      </motion.g>

      <motion.g
        filter="url(#paper-shadow-5)"
        initial={shouldReduce ? false : { opacity: 0, x: 15 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <path d="M282 72C282 64 288 60 297 60C306 60 312 64 312 72H282Z" fill="#474329" />
        <rect x="284" y="72" width="26" height="24" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M272 165C272 130 284 120 297 120C310 120 322 130 322 165H272Z" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <text x="297" y="180" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">
          PROVIDER
        </text>
      </motion.g>

      {/* Layer 3: Banknote slides into vault */}
      <motion.g
        initial={shouldReduce ? false : { opacity: 0, x: -35 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.22, duration: 0.45, ease: paperEase }}
      >
        <rect x="95" y="98" width="35" height="18" rx="3" fill="#FAF4ED" stroke="#474329" strokeWidth="1.5" />
        <text x="112" y="110" fill="#474329" fontSize="6" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          NGN
        </text>
      </motion.g>

      {/* Layer 4 (Focal): Central Escrow Vault Lock with clicking shackle */}
      <motion.g
        filter="url(#paper-shadow-5)"
        initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.5, ease: paperEase }}
      >
        <rect x="135" y="65" width="90" height="85" rx="16" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />

        {/* Shackle clicks shut */}
        <motion.path
          d="M160 65V48C160 38 200 38 200 48V65"
          stroke="#474329"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduce ? false : { y: -10 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.45, type: 'spring', damping: 10, stiffness: 240 }}
        />

        <circle cx="180" cy="102" r="18" fill="#FC75B4" fillOpacity="0.25" stroke="#FC75B4" strokeWidth="2" />
        <circle cx="180" cy="100" r="5" fill="#474329" />
        <path d="M180 104V113" stroke="#474329" strokeWidth="3" strokeLinecap="round" />
        <rect x="145" y="130" width="70" height="14" rx="4" fill="#474329" />
        <text x="180" y="140" fill="#FAF4ED" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          ESCROW LOCKED
        </text>
      </motion.g>

      {/* Two Milestone Checkboxes that tick in sequence */}
      <motion.g
        initial={shouldReduce ? false : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, type: 'spring', damping: 14 }}
      >
        <circle cx="160" cy="165" r="6" fill="#FC75B4" />
        <path d="M157 165L159 167L164 163" stroke="#474329" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
      <motion.g
        initial={shouldReduce ? false : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.75, type: 'spring', damping: 14 }}
      >
        <circle cx="200" cy="165" r="6" fill="#FC75B4" />
        <path d="M197 165L199 167L204 163" stroke="#474329" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>

      {/* Directional Paper Pointer */}
      <PaperPointer x={232} y={102} angle={0} label="VAULT" delay={0.8} reduced={shouldReduce} />

      {/* Pink Pulse */}
      <PinkPulse cx={180} cy={102} r={22} delay={0.65} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 6: Payment settles on Concordium (x402 receipt) */
export function Scene6ConcordiumSettlement({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false
  const [typedHash, setTypedHash] = useState('')
  const fullHash = 'TX: 4221332d...f027'

  useEffect(() => {
    if (shouldReduce) {
      setTypedHash(fullHash)
      return
    }
    let idx = 0
    const interval = setInterval(() => {
      idx += 1
      setTypedHash(fullHash.slice(0, idx))
      if (idx >= fullHash.length) {
        clearInterval(interval)
      }
    }, 70)
    return () => clearInterval(interval)
  }, [shouldReduce])

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 6: Settlement"
      whileHover={shouldReduce ? undefined : { rotate: -0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-6" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-6)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Focal): Receipt rolls out like paper tape from cash register */}
      <motion.g
        filter="url(#paper-shadow-6)"
        initial={shouldReduce ? false : { opacity: 0, scaleY: 0.2, y: -25 }}
        animate={{ opacity: 1, scaleY: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: paperEase }}
        style={{ originY: '32px' }}
      >
        <rect x="75" y="32" width="210" height="155" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <rect x="95" y="48" width="170" height="24" rx="6" fill="#474329" />
        <text x="180" y="63" fill="#FAF4ED" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          X402 CONCORDIUM RECEIPT
        </text>

        {/* Checkmark circle */}
        <circle cx="115" cy="98" r="14" fill="#FC75B4" />
        <path d="M109 98L113 102L122 93" stroke="#474329" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <text x="140" y="94" fill="#474329" fontSize="9" fontWeight="bold">
          SETTLEMENT COMPLETE
        </text>

        {/* Character-by-character typed tx hash */}
        <text x="140" y="106" fill="#474329" fillOpacity="0.8" fontSize="8" fontFamily="monospace">
          {typedHash}
        </text>

        <path d="M95 125H265" stroke="#474329" strokeWidth="1.5" strokeDasharray="4 3" />

        <text x="95" y="145" fill="#474329" fontSize="9">
          Amount Paid:
        </text>
        <text x="265" y="145" fill="#474329" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">
          NGN 15,000
        </text>

        <text x="95" y="162" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace">
          DIRECT PEER-TO-PEER // 0% INTERMEDIARY
        </text>
      </motion.g>

      {/* Directional Paper Pointer */}
      <PaperPointer x={65} y={98} angle={180} label="RECEIPT" delay={0.6} reduced={shouldReduce} />

      {/* Pink Pulse */}
      <PinkPulse cx={115} cy={98} r={16} delay={0.5} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 7: Zero-Knowledge Identity (Prove without showing) */
export function Scene7ZeroKnowledgeIdentity({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 7: Zero-Knowledge Privacy"
      whileHover={shouldReduce ? undefined : { rotate: 0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-7" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-7)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Prop): Paper document unfolds on left */}
      <motion.g
        filter="url(#paper-shadow-7)"
        initial={shouldReduce ? false : { opacity: 0, scaleY: 0.3, y: 20 }}
        animate={{ opacity: 1, scaleY: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: paperEase }}
        style={{ originY: '110px' }}
      >
        <rect x="40" y="50" width="110" height="120" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <rect x="52" y="62" width="40" height="40" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />

        {/* Stacked reviews / redacted bars */}
        <motion.rect
          x="52"
          y="112"
          width="86"
          height="8"
          rx="4"
          fill="#474329"
          initial={shouldReduce ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        />
        <motion.rect
          x="52"
          y="125"
          width="70"
          height="8"
          rx="4"
          fill="#474329"
          initial={shouldReduce ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.42, duration: 0.3 }}
        />
        <motion.rect
          x="52"
          y="138"
          width="55"
          height="8"
          rx="4"
          fill="#474329"
          initial={shouldReduce ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.54, duration: 0.3 }}
        />

        <rect x="48" y="42" width="75" height="16" rx="4" fill="#474329" />
        <text x="85" y="53" fill="#FAF4ED" fontSize="7" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          PRIVATE DATA
        </text>
      </motion.g>

      {/* ZK Proof transformation arrow */}
      <motion.g
        initial={shouldReduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <path d="M165 110H200" stroke="#FC75B4" strokeWidth="3" strokeDasharray="4 3" />
        <polygon points="205,110 197,105 197,115" fill="#FC75B4" />
      </motion.g>

      {/* Layer 3 (Focal): Verified human badge settles on top with solid thud */}
      <motion.g
        filter="url(#paper-shadow-7)"
        initial={shouldReduce ? false : { opacity: 0, y: -30, scale: 1.25 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, type: 'spring', damping: 14, stiffness: 220 }}
      >
        <rect x="215" y="50" width="105" height="120" rx="10" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <circle cx="267" cy="95" r="24" fill="#FC75B4" fillOpacity="0.2" stroke="#FC75B4" strokeWidth="2" />
        <circle cx="267" cy="95" r="14" fill="#474329" />
        <path d="M261 95L265 99L274 90" stroke="#FAF4ED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="267" y="138" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">
          VERIFIED HUMAN
        </text>
        <text x="267" y="148" fill="#474329" fillOpacity="0.6" fontSize="7" fontFamily="monospace" textAnchor="middle">
          NO ID LEAKED
        </text>
      </motion.g>

      {/* Directional Paper Pointer */}
      <PaperPointer x={205} y={95} angle={180} label="PRIVATE" delay={0.75} reduced={shouldReduce} />

      {/* Pink Pulse */}
      <PinkPulse cx={267} cy={95} r={26} delay={0.8} reduced={shouldReduce} />
    </motion.svg>
  )
}

/** Scene 8: The agent asks before it spends (Guard Cap & Article 12 audit) */
export function Scene8AgentConsentGuards({
  className = 'w-full h-auto max-w-sm',
  width = 360,
  height = 220,
}: SceneProps) {
  const shouldReduce = useReducedMotion() ?? false

  return (
    <motion.svg
      viewBox="0 0 360 220"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Scene 8: Agent Boundaries"
      whileHover={shouldReduce ? undefined : { rotate: -0.8 }}
      whileTap={shouldReduce ? undefined : { scale: 0.98 }}
    >
      <defs>
        <filter id="paper-shadow-8" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#474329" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Layer 1 (Ground) */}
      <motion.rect
        x="15"
        y="15"
        width="330"
        height="190"
        rx="16"
        fill="#F0E5DB"
        stroke="#474329"
        strokeWidth="2.5"
        filter="url(#paper-shadow-8)"
        initial={shouldReduce ? false : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: paperEase }}
      />

      {/* Layer 2 (Character): proxidAI scout holding banner */}
      <motion.g
        filter="url(#paper-shadow-8)"
        initial={shouldReduce ? false : { opacity: 0, x: -25 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: paperEase }}
      >
        <rect x="40" y="65" width="60" height="65" rx="14" fill="#FAF4ED" stroke="#474329" strokeWidth="2" />
        <path d="M70 65V50" stroke="#474329" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="46" r="4" fill="#FC75B4" />
        <rect x="48" y="78" width="44" height="22" rx="8" fill="#474329" />
        <circle cx="60" cy="89" r="3" fill="#FC75B4" />
        <circle cx="80" cy="89" r="3" fill="#FC75B4" />
      </motion.g>

      {/* Layer 3: Paper banknote offered by agent hand */}
      <motion.g
        initial={shouldReduce ? false : { opacity: 0, x: -30 }}
        animate={shouldReduce ? undefined : { opacity: 1, x: [0, 0, 80] }}
        transition={{ delay: 0.25, duration: 2.2, repeat: Infinity, repeatDelay: 2.5, ease: paperEase }}
      >
        <rect x="90" y="88" width="28" height="15" rx="3" fill="#FAF4ED" stroke="#474329" strokeWidth="1.5" />
        <text x="104" y="99" fill="#474329" fontSize="6" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          x402
        </text>
      </motion.g>

      {/* Layer 4 (Focal): Consent Dialog Box with interactive checkmark button */}
      <motion.g
        filter="url(#paper-shadow-8)"
        initial={shouldReduce ? false : { opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.45, ease: paperEase }}
      >
        <rect x="120" y="42" width="200" height="135" rx="12" fill="#FAF4ED" stroke="#474329" strokeWidth="2.5" />
        <rect x="135" y="55" width="170" height="20" rx="5" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="220" y="68" fill="#474329" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
          SPEND GUARD // CAP: NGN 10,000
        </text>

        <text x="135" y="92" fill="#474329" fontSize="9" fontWeight="bold">
          Authorize Milestone Release?
        </text>
        <text x="135" y="105" fill="#474329" fillOpacity="0.7" fontSize="8">
          Tunde completed the pipe repair.
        </text>

        <rect x="135" y="122" width="70" height="26" rx="6" fill="#F0E5DB" stroke="#474329" strokeWidth="1.5" />
        <text x="170" y="138" fill="#474329" fontSize="8" fontWeight="bold" textAnchor="middle">
          Reject
        </text>

        {/* Approve button with thumb press effect */}
        <motion.g
          animate={shouldReduce ? undefined : { scale: [1, 1, 0.94, 1] }}
          transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.4, delay: 0.8 }}
          style={{ originX: '260px', originY: '135px' }}
        >
          <rect x="215" y="122" width="90" height="26" rx="6" fill="#474329" />
          <text x="260" y="138" fill="#FAF4ED" fontSize="8" fontWeight="bold" textAnchor="middle">
            Approve (x402)
          </text>
        </motion.g>

        <text x="220" y="166" fill="#474329" fillOpacity="0.5" fontSize="7" fontFamily="monospace" textAnchor="middle">
          ARTICLE 12 AUDIT TRAIL LOGGED
        </text>
      </motion.g>

      {/* Directional Paper Pointer pointing to Approve button */}
      <PaperPointer x={205} y={135} angle={180} label="CONSENT" delay={0.65} reduced={shouldReduce} />

      {/* Pink Pulse */}
      <PinkPulse cx={260} cy={135} r={18} delay={0.7} reduced={shouldReduce} />
    </motion.svg>
  )
}
