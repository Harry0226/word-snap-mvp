import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import Countdown from '../../components/shared/Countdown'
import Card from '../../components/shared/Card'
import Button from '../../components/shared/Button'
import EmptyState from '../../components/shared/EmptyState'
import { daysBetween, formatDateCN, getMoodEmoji } from '../../lib/dateUtils'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const { profile, anniversaries, moodEntries } = useStore()

  // Calculate days together
  const daysTogether = profile?.relationshipStartDate
    ? daysBetween(profile.relationshipStartDate, new Date())
    : 0

  // Get today's mood
  const today = new Date().toISOString().split('T')[0]
  const todayMood1 = moodEntries.find(
    (m) => m.date === today && m.partner === 'partner1'
  )
  const todayMood2 = moodEntries.find(
    (m) => m.date === today && m.partner === 'partner2'
  )

  // Quick access items
  const quickAccessItems = [
    { icon: '💕', label: '纪念日', path: '/anniversary' },
    { icon: '💬', label: '留言板', path: '/interaction' },
    { icon: '🎯', label: '共同目标', path: '/goals' },
    { icon: '📸', label: '相册', path: '/gallery' },
    { icon: '🎮', label: '小游戏', path: '/games' },
  ]

  // Show onboarding if not set up
  if (!profile) {
    return (
      <EmptyState
        icon="💑"
        title="欢迎来到我们的故事"
        description="开始记录你们的甜蜜时光，添加你们的信息开始吧！"
        action={
          <Link to="/anniversary">
            <Button>开始设置</Button>
          </Link>
        }
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Hero Section */}
      <section className="text-center py-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1
            className="text-4xl md:text-5xl font-bold text-[var(--color-accent-terracotta)] mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {profile.partner1Name} & {profile.partner2Name}
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)]">
            我们的故事，从这里开始
          </p>
        </motion.div>
      </section>

      {/* Days Counter */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-8 text-center shadow-[var(--shadow-md)]">
        <h2 className="text-xl text-[var(--color-text-muted)] mb-2">
          在一起已经
        </h2>
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl md:text-7xl font-bold text-[var(--color-accent-terracotta)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {daysTogether}
        </motion.div>
        <p className="text-2xl text-[var(--color-text-secondary)] mt-2">天</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-4">
          从 {formatDateCN(profile.relationshipStartDate)} 开始
        </p>
      </section>

      {/* Next Anniversary Countdown */}
      {anniversaries.length > 0 && (
        <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
          <h3
            className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            🎉 距离下一个纪念日
          </h3>
          <Countdown targetDate={anniversaries[0].date} label={anniversaries[0].title} />
        </section>
      )}

      {/* Today's Mood */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h3
          className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          😊 今日心情
        </h3>
        <div className="flex justify-around">
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl mb-2"
            >
              {todayMood1 ? getMoodEmoji(todayMood1.mood) : '😊'}
            </motion.div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {profile.partner1Name}
            </p>
          </div>
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              className="text-5xl mb-2"
            >
              {todayMood2 ? getMoodEmoji(todayMood2.mood) : '🥰'}
            </motion.div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {profile.partner2Name}
            </p>
          </div>
        </div>
      </section>

      {/* Quick Access Cards */}
      <section>
        <h2
          className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          快速访问
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickAccessItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={item.path}>
                <Card className="text-center hover:scale-105 transition-transform">
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {item.label}
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Recent Milestones */}
      {anniversaries.length > 0 && (
        <section>
          <h2
            className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            📅 重要日期
          </h2>
          <div className="space-y-3">
            {anniversaries.slice(0, 3).map((anniversary) => (
              <Card key={anniversary.id} animate={false}>
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{anniversary.icon || '💕'}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      {anniversary.title}
                    </h4>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatDateCN(anniversary.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[var(--color-accent-terracotta)]">
                      {daysBetween(anniversary.date, new Date())}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">天</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  )
}
