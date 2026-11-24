/**
 * Vector map pin generator for Leaflet.
 *
 * Requirements:
 * - Circular avatar inside each pin with the marker tail.
 * - If provider has no avatar, a cartoon face.
 * - Verified providers display the official Concordium mark from /brands/concordium.svg.
 * - Service pins use Ink (#474329); Job pins use Accent (#FC75B4).
 * - 100% ASCII pure.
 */

import L from 'leaflet'

export interface PinData {
  id: string
  kind: 'provider' | 'job'
  title: string
  price?: number | null
  avatarUrl?: string | null
  verified?: boolean
}

/** Cartoon face SVG for providers without a custom photo */
const CARTOON_PROVIDER_FACE = `
<svg viewBox="0 0 32 32" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="16" fill="#FAF4ED"/>
  <path d="M8 13C8 9 11 6 16 6C21 6 24 9 24 13H8Z" fill="#474329"/>
  <path d="M23 13C25 13 26 14 27 15H22" stroke="#474329" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="16" cy="10" r="1.5" fill="#FC75B4"/>
  <rect x="10" y="13" width="12" height="11" rx="5.5" fill="#FAF4ED" stroke="#474329" stroke-width="1.5"/>
  <circle cx="13.5" cy="17" r="1" fill="#474329"/>
  <circle cx="18.5" cy="17" r="1" fill="#474329"/>
  <path d="M14 20.5C15 21.5 17 21.5 18 20.5" stroke="#474329" stroke-width="1.2" stroke-linecap="round"/>
</svg>
`.trim()

/** Cartoon house/task SVG for jobs */
const CARTOON_JOB_ICON = `
<svg viewBox="0 0 32 32" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="16" fill="#FAF4ED"/>
  <path d="M7 16L16 8L25 16" stroke="#474329" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="8" r="1.5" fill="#FC75B4"/>
  <rect x="10" y="16" width="12" height="9" rx="2" fill="#FAF4ED" stroke="#474329" stroke-width="1.5"/>
  <rect x="14" y="19" width="4" height="6" rx="1" fill="#474329"/>
</svg>
`.trim()

export function createPinIcon(point: PinData, active: boolean): L.DivIcon {
  const isJob = point.kind === 'job'
  const isVerified = Boolean(point.verified)

  // Service pins: Ink (#474329). Job pins: Accent (#FC75B4).
  const pinColor = isJob ? '#FC75B4' : '#474329'
  const borderColor = active ? '#FC75B4' : pinColor

  // Inner avatar
  const innerContent = point.avatarUrl
    ? `<img src="${point.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;" alt="" />`
    : isJob
      ? CARTOON_JOB_ICON
      : CARTOON_PROVIDER_FACE

  // Official Concordium badge using /brands/concordium.svg
  const concordiumBadge = isVerified
    ? `
      <div style="
        position:absolute;
        top:-3px;
        right:-3px;
        width:15px;
        height:15px;
        border-radius:9999px;
        background:#FAF4ED;
        border:1.5px solid #474329;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 1px 3px rgba(71,67,41,0.25);
        z-index:2;
      " title="Concordium Verified">
        <img src="/brands/concordium.svg" style="width:10px;height:10px;display:block;" alt="Concordium" />
      </div>
    `
    : ''

  const halo = active
    ? `<div style="position:absolute;inset:-4px;border-radius:9999px;background:${pinColor};opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
    : ''

  const html = `
    <div class="proxid-pin-wrapper ${active ? 'z-50' : ''}" style="position:relative;width:36px;height:46px;transform-origin:50% 100%;">
      ${halo}
      <!-- Round Head -->
      <div style="
        position:absolute;
        top:0;
        left:0;
        width:36px;
        height:36px;
        border-radius:9999px;
        background:${pinColor};
        border:2px solid ${borderColor};
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 3px 8px rgba(71,67,41,0.25);
        ${active ? 'outline:2px solid #FAF4ED;outline-offset:1px;' : ''}
      ">
        <div style="
          width:28px;
          height:28px;
          border-radius:9999px;
          overflow:hidden;
          background:#FAF4ED;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          ${innerContent}
        </div>
      </div>

      <!-- Verified Corner Badge -->
      ${concordiumBadge}

      <!-- Marker Tail -->
      <div style="
        position:absolute;
        top:32px;
        left:50%;
        transform:translateX(-50%);
        width:0;
        height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:11px solid ${pinColor};
      "></div>
    </div>
  `

  return L.divIcon({
    className: 'proxid-avatar-marker',
    iconSize: [36, 46],
    iconAnchor: [18, 45],
    popupAnchor: [0, -42],
    html,
  })
}
