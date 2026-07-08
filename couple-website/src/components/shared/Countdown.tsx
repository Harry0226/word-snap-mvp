import { useEffect, useState } from 'react'
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns'
import { motion } from 'framer-motion'

interface CountdownProps {
  targetDate: string
  label?: string
  showBreathe?: boolean
}

export default function Countdown({ targetDate, label, showBreathe = true }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const target = new Date(targetDate)

      if (target <= now) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      setTimeLeft({
        days: differenceInDays(target, now),
        hours: differenceInHours(target, now) % 24,
        minutes: differenceInMinutes(target, now) % 60,
        seconds: differenceInSeconds(target, now) % 60,
      })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  const TimeUnit = ({ value, unit }: { value: number; unit: string }) => (
    <div className="text-center">
      <motion.div
        animate={showBreathe ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-4xl md:text-5xl font-bold text-[var(--color-accent-terracotta)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value.toString().padStart(2, '0')}
      </motion.div>
      <div className="text-sm text-[var(--color-text-muted)] mt-1">{unit}</div>
    </div>
  )

  return (
    <div className="text-center">
      {label && (
        <h3 className="text-lg text-[var(--color-text-secondary)] mb-4">{label}</h3>
      )}
      <div className="flex justify-center gap-6 md:gap-8">
        <TimeUnit value={timeLeft.days} unit="天" />
        <TimeUnit value={timeLeft.hours} unit="时" />
        <TimeUnit value={timeLeft.minutes} unit="分" />
        <TimeUnit value={timeLeft.seconds} unit="秒" />
      </div>
    </div>
  )
}
