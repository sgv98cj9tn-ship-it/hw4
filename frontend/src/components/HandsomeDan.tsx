import { useId } from 'react'

/**
 * Original cartoon of Handsome Dan, the Yale bulldog, as a knight in Yale-themed
 * chainmail. Drawn as SVG (not based on any photo). `variant="head"` crops to his
 * face for the chat avatar.
 */
export default function HandsomeDan({
  variant = 'full',
  className,
  title = 'Handsome Dan, the Yale bulldog, in Yale chainmail',
}: {
  variant?: 'full' | 'head'
  className?: string
  title?: string
}) {
  const id = useId().replace(/:/g, '')
  const mail = `mail-${id}`
  const shine = `shine-${id}`
  const viewBox = variant === 'head' ? '88 30 224 224' : '0 0 400 460'

  return (
    <svg
      viewBox={viewBox}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      // An empty title means the drawing is decorative (e.g. next to his name).
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <defs>
        {/* Chainmail: rows of small interlocking rings */}
        <pattern id={mail} width="9" height="8" patternUnits="userSpaceOnUse">
          <rect width="9" height="8" fill="#b9c3d1" />
          <circle cx="4.5" cy="4" r="3.1" fill="none" stroke="#7d8899" strokeWidth="1.3" />
          <circle cx="0" cy="0" r="3.1" fill="none" stroke="#7d8899" strokeWidth="1.3" />
          <circle cx="9" cy="0" r="3.1" fill="none" stroke="#7d8899" strokeWidth="1.3" />
          <circle cx="0" cy="8" r="3.1" fill="none" stroke="#7d8899" strokeWidth="1.3" />
          <circle cx="9" cy="8" r="3.1" fill="none" stroke="#7d8899" strokeWidth="1.3" />
        </pattern>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g stroke="#0b1a33" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        {variant === 'full' && (
          <>
            {/* Ground shadow */}
            <ellipse cx="200" cy="438" rx="128" ry="14" fill="#000" opacity="0.25" stroke="none" />

            {/* Back legs peeking out */}
            <path d="M118 360 q-14 50 6 72 h34 q6 -30 4 -60 z" fill="#e9dccb" />
            <path d="M282 360 q14 50 -6 72 h-34 q-6 -30 -4 -60 z" fill="#e9dccb" />

            {/* Chainmail body */}
            <path
              d="M108 250 q-14 70 6 140 q86 26 172 0 q20 -70 6 -140 q-36 -26 -92 -26 q-56 0 -92 26 z"
              fill={`url(#${mail})`}
            />

            {/* Yale Blue tabard with a white Y */}
            <path d="M150 236 h100 v132 l-50 26 l-50 -26 z" fill="#00356B" />
            <path
              d="M166 262 h26 l8 16 l8 -16 h26 l-24 38 v38 h-20 v-38 z"
              fill="#ffffff"
              strokeWidth="4"
            />

            {/* Belt */}
            <path d="M112 330 q88 18 176 0 v18 q-88 18 -176 0 z" fill="#5a3b22" />
            <rect x="188" y="331" width="24" height="22" rx="4" fill="#d9b44a" />

            {/* Front legs and paws */}
            <path d="M140 372 v48 q0 14 16 14 h20 q12 0 12 -12 v-50 z" fill="#f7f1e8" />
            <path d="M212 372 v50 q0 12 12 12 h20 q16 0 16 -14 v-48 z" fill="#f7f1e8" />
            <path d="M160 434 v-10 M172 434 v-10 M228 434 v-10 M240 434 v-10" strokeWidth="3.5" fill="none" />
          </>
        )}

        {/* Chainmail coif (hood) around the head */}
        <path
          d="M96 164 q-10 -112 104 -128 q114 16 104 128 q2 64 -32 92 h-144 q-34 -28 -32 -92 z"
          fill={`url(#${mail})`}
        />
        <path d="M110 128 q30 -74 90 -84" fill="none" stroke={`url(#${shine})`} strokeWidth="10" />

        {/* Rose ears folded against the coif */}
        <path d="M128 104 q-10 -26 14 -30 q18 6 14 24 z" fill="#d7b48c" />
        <path d="M272 104 q10 -26 -14 -30 q-18 6 -14 24 z" fill="#d7b48c" />

        {/* Broad, flat bulldog head */}
        <path
          d="M120 168 q0 -82 80 -84 q80 2 80 84 q2 48 -30 66 q-50 22 -100 0 q-32 -18 -30 -66 z"
          fill="#f7f1e8"
        />
        {/* Tan patch over his left eye */}
        <path d="M214 98 q50 4 60 64 q-22 14 -46 4 q-22 -24 -14 -68 z" fill="#d7b48c" stroke="none" />

        {/* Forehead wrinkles */}
        <path d="M172 112 q28 -10 56 0 M178 126 q22 -7 44 0" fill="none" strokeWidth="3.5" />

        {/* Wide-set eyes with heavy brows */}
        <path d="M150 140 q14 -8 28 2 M222 142 q14 -10 28 -2" fill="none" strokeWidth="4.5" />
        <circle cx="164" cy="154" r="10" fill="#1b2433" />
        <circle cx="236" cy="154" r="10" fill="#1b2433" />
        <circle cx="160" cy="150" r="3.2" fill="#fff" stroke="none" />
        <circle cx="232" cy="150" r="3.2" fill="#fff" stroke="none" />
        {/* Folds under the eyes */}
        <path d="M150 172 q14 8 26 0 M224 172 q14 8 26 0" fill="none" strokeWidth="3" />

        {/* Underbite: lower jaw juts out below the jowls, teeth pointing up */}
        <path d="M164 218 q36 30 72 0 q6 20 -36 28 q-42 -8 -36 -28 z" fill="#c9566a" />
        <path d="M176 222 l6 -14 l6 14 z M212 222 l6 -14 l6 14 z" fill="#ffffff" strokeWidth="2.5" />

        {/* Big droopy jowls */}
        <path
          d="M146 182 q-16 46 22 50 q18 2 32 -12 q14 14 32 12 q38 -4 22 -50 q-54 -16 -108 0 z"
          fill="#f7f1e8"
        />

        {/* Wide, flat nose */}
        <path d="M176 176 q24 -14 48 0 q2 14 -24 20 q-26 -6 -24 -20 z" fill="#1b2433" />
        <ellipse cx="190" cy="180" rx="4" ry="2.5" fill="#4a5466" stroke="none" />
        <path d="M200 196 v14" strokeWidth="3.5" />
      </g>
    </svg>
  )
}
