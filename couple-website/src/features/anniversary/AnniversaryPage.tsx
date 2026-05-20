import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useStore, type Anniversary } from '../../store/useStore'
import Button from '../../components/shared/Button'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'
import { daysBetween, formatDateCN, daysUntilAnniversary, isWithinDays } from '../../lib/dateUtils'

export default function AnniversaryPage() {
  const { anniversaries, addAnniversary, deleteAnniversary } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    icon: '💕',
    isRecurring: true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.date) return

    const newAnniversary: Anniversary = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.title,
      date: formData.date,
      icon: formData.icon,
      isRecurring: formData.isRecurring,
    }

    addAnniversary(newAnniversary)
    setFormData({ title: '', date: '', icon: '💕', isRecurring: true })
    setShowForm(false)
  }

  const iconOptions = ['💕', '🌟', '🌹', '💑', '🎂', '🎉', '💍', '✈️']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h1
          className="text-3xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          💕 纪念日
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 添加纪念日'}
        </Button>
      </div>

      {/* Add Anniversary Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    纪念日名称
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="例如：相识纪念日"
                    className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    日期
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    图标
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`text-2xl p-2 rounded-[var(--radius-sm)] transition-all ${
                          formData.icon === icon
                            ? 'bg-[var(--color-accent-terracotta)] bg-opacity-20 scale-110'
                            : 'hover:bg-[var(--color-surface-elevated)]'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={formData.isRecurring}
                    onChange={(e) =>
                      setFormData({ ...formData, isRecurring: e.target.checked })
                    }
                    className="w-4 h-4 accent-[var(--color-accent-terracotta)]"
                  />
                  <label
                    htmlFor="recurring"
                    className="text-sm text-[var(--color-text-secondary)]"
                  >
                    每年重复
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">保存</Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowForm(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anniversary List */}
      {anniversaries.length === 0 ? (
        <EmptyState
          icon="💕"
          title="还没有纪念日"
          description="添加你们的第一个纪念日，开始倒计时吧！"
          action={
            <Button onClick={() => setShowForm(true)}>添加纪念日</Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {anniversaries
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((anniversary, index) => (
              <motion.div
                key={anniversary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{anniversary.icon || '💕'}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {anniversary.title}
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {formatDateCN(anniversary.date)}
                        {anniversary.isRecurring && ' · 每年重复'}
                      </p>

                      {/* Countdown or Days Since */}
                      <div className="mt-3">
                        {isWithinDays(anniversary.date, 30) ? (
                          <div className="text-sm text-[var(--color-accent-terracotta)]">
                            还有 {daysUntilAnniversary(anniversary.date)} 天
                          </div>
                        ) : (
                          <div className="text-sm text-[var(--color-text-muted)]">
                            已经 {daysBetween(anniversary.date, new Date())} 天
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteAnniversary(anniversary.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors p-2"
                    >
                      ✕
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
        </div>
      )}

      {/* Upcoming Anniversaries */}
      {anniversaries.length > 0 && (
        <section>
          <h2
            className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            🎉 即将到来
          </h2>
          <div className="space-y-3">
            {anniversaries
              .filter((a) => daysUntilAnniversary(a.date) <= 30)
              .map((anniversary) => (
                <Card key={anniversary.id} animate={false}>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{anniversary.icon || '🎂'}</div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">
                        {anniversary.title}
                      </h3>
                      <p className="text-sm text-[var(--color-accent-terracotta)]">
                        还有 {daysUntilAnniversary(anniversary.date)} 天
                      </p>
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
