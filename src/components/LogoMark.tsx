/**
 * The Site Monitors mark: a pulse line drawn as an "M", ending in a live-status dot, on the teal tile.
 * The same drawing as public/brand/site-monitors-icon.svg, inline so it needs no extra request.
 */
export default function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id="sm-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#sm-logo-bg)" />
      <path d="M80 306H158L206 174L256 336L306 174L354 306H374" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="426" cy="306" r="26" fill="#fff" />
    </svg>
  );
}
