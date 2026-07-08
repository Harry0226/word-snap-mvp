import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  animate?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', animate = true, onClick }: CardProps) {
  const Component = animate ? motion.div : 'div'

  const animationProps = animate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
      }
    : {}

  return (
    <Component
      {...animationProps}
      className={`bg-[var(--color-surface-card)] rounded-[var(--radius-md)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </Component>
  )
}
