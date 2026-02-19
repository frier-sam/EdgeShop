interface Props {
  text: string
  color?: string
}

export default function AnnouncementBar({ text, color = '#1A1A1A' }: Props) {
  return (
    <div
      className="w-full py-2 px-4 text-center text-sm text-white"
      style={{ backgroundColor: color }}
    >
      {text}
    </div>
  )
}
