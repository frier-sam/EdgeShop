interface PageTransitionProps {
  children: React.ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="page-enter">
      {children}
    </div>
  )
}
