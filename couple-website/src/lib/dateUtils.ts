import {
  differenceInDays,
  differenceInYears,
  format,
  addYears,
  isBefore,
  startOfDay,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return differenceInDays(end, start)
}

/**
 * Calculate years between two dates
 */
export function yearsBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return differenceInYears(end, start)
}

/**
 * Format date in Chinese
 */
export function formatDateCN(date: string | Date, formatStr: string = 'yyyy年MM月dd日'): string {
  return format(new Date(date), formatStr, { locale: zhCN })
}

/**
 * Get next anniversary date
 */
export function getNextAnniversary(anniversaryDate: string): Date {
  const anniversary = new Date(anniversaryDate)
  const today = startOfDay(new Date())
  const thisYear = addYears(anniversary, differenceInYears(today, anniversary))

  if (isBefore(thisYear, today)) {
    return addYears(thisYear, 1)
  }

  return thisYear
}

/**
 * Get days until next anniversary
 */
export function daysUntilAnniversary(anniversaryDate: string): number {
  const nextAnniversary = getNextAnniversary(anniversaryDate)
  const today = startOfDay(new Date())
  return differenceInDays(nextAnniversary, today)
}

/**
 * Check if date is within N days
 */
export function isWithinDays(date: string | Date, days: number): boolean {
  const target = new Date(date)
  const today = startOfDay(new Date())
  const diff = differenceInDays(target, today)
  return diff >= 0 && diff <= days
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const target = new Date(date)
  const today = startOfDay(new Date())
  const diff = differenceInDays(today, target)

  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === -1) return '明天'
  if (diff > 0) return `${diff}天前`
  return `${Math.abs(diff)}天后`
}

/**
 * Get mood emoji
 */
export function getMoodEmoji(mood: string): string {
  const moodMap: Record<string, string> = {
    happy: '😊',
    love: '🥰',
    calm: '😌',
    sad: '😢',
    angry: '😠',
    excited: '🤩',
  }
  return moodMap[mood] || '😊'
}

/**
 * Get mood label
 */
export function getMoodLabel(mood: string): string {
  const labelMap: Record<string, string> = {
    happy: '开心',
    love: '恋爱',
    calm: '平静',
    sad: '难过',
    angry: '生气',
    excited: '兴奋',
  }
  return labelMap[mood] || '开心'
}
