interface Props {
  text: string
  color?: string
}

export default function AnnouncementBar({ text, color }: Props) {
  const repeated = `${text}     \u2022     ${text}     \u2022     ${text}     \u2022     `

  return (
    <div
      className="relative z-50 w-full py-2 overflow-hidden"
      style={{ backgroundColor: color ?? 'var(--color-primary)' }}
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .announcement-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 22s linear infinite;
          white-space: nowrap;
        }
        .announcement-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="announcement-track text-sm font-light tracking-[0.12em]" style={{ color: 'var(--color-bg)' }}>
        <span className="px-8">{repeated}</span>
        <span className="px-8" aria-hidden="true">{repeated}</span>
      </div>
    </div>
  )
}
