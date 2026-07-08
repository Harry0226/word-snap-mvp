import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useStore, type Goal, type SubTask } from '../../store/useStore'
import Button from '../../components/shared/Button'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'

const categoryIcons: Record<string, string> = {
  travel: '✈️',
  finance: '💰',
  health: '💪',
  learning: '📚',
  home: '🏠',
}

const categoryLabels: Record<string, string> = {
  travel: '旅行',
  finance: '财务',
  health: '健康',
  learning: '学习',
  home: '家庭',
}

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal, toggleSubTask } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [showCelebration, setShowCelebration] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    category: 'travel' as Goal['category'],
    targetValue: 100,
    unit: '%',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return

    const newGoal: Goal = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.title,
      category: formData.category,
      targetValue: formData.targetValue,
      currentValue: 0,
      unit: formData.unit,
      subTasks: [],
      createdAt: new Date().toISOString(),
    }

    addGoal(newGoal)
    setFormData({ title: '', category: 'travel', targetValue: 100, unit: '%' })
    setShowForm(false)
  }

  const handleProgressUpdate = (goalId: string, newValue: number) => {
    const goal = goals.find((g) => g.id === goalId)
    if (!goal) return

    const updatedValue = Math.min(newValue, goal.targetValue)
    updateGoal(goalId, { currentValue: updatedValue })

    if (updatedValue >= goal.targetValue) {
      setShowCelebration(goalId)
      setTimeout(() => setShowCelebration(null), 3000)
    }
  }

  const addSubTask = (goalId: string, title: string) => {
    const goal = goals.find((g) => g.id === goalId)
    if (!goal) return

    const newSubTask: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      completed: false,
    }

    updateGoal(goalId, {
      subTasks: [...goal.subTasks, newSubTask],
    })
  }

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
          🎯 共同目标
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 新建目标'}
        </Button>
      </div>

      {/* Add Goal Form */}
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
                    目标名称
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="例如：日本旅行基金"
                    className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    类别
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            category: key as Goal['category'],
                          })
                        }
                        className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] transition-all ${
                          formData.category === key
                            ? 'bg-[var(--color-accent-terracotta)] text-[var(--color-text-inverse)]'
                            : 'bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)]'
                        }`}
                      >
                        <span>{categoryIcons[key]}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      目标值
                    </label>
                    <input
                      type="number"
                      value={formData.targetValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          targetValue: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      单位
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      placeholder="%"
                      className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">创建目标</Button>
                  <Button variant="secondary" onClick={() => setShowForm(false)}>
                    取消
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals List */}
      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="还没有共同目标"
          description="创建你们的第一个目标，一起努力实现吧！"
          action={<Button onClick={() => setShowForm(true)}>创建目标</Button>}
        />
      ) : (
        <div className="space-y-4">
          {goals.map((goal, index) => {
            const progress = (goal.currentValue / goal.targetValue) * 100
            const isComplete = progress >= 100

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{categoryIcons[goal.category]}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {goal.title}
                          </h3>
                          <span className="text-sm text-[var(--color-accent-sage)] bg-[var(--color-accent-sage)] bg-opacity-20 px-2 py-1 rounded-[var(--radius-full)]">
                            {categoryLabels[goal.category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={
                              showCelebration === goal.id
                                ? { scale: [1, 1.2, 1] }
                                : {}
                            }
                            className="text-2xl font-bold text-[var(--color-accent-terracotta)]"
                          >
                            {Math.round(progress)}%
                          </motion.span>
                          <button
                            onClick={() => deleteGoal(goal.id)}
                            className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-[var(--color-surface-elevated)] rounded-[var(--radius-full)] h-3 mb-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className={`h-full rounded-[var(--radius-full)] ${
                            isComplete
                              ? 'bg-gradient-to-r from-[var(--color-accent-ochre)] to-[var(--color-accent-terracotta)]'
                              : 'bg-gradient-to-r from-[var(--color-accent-sage)] to-[var(--color-accent-terracotta)]'
                          }`}
                        />
                      </div>

                      <div className="flex justify-between text-sm text-[var(--color-text-muted)] mb-3">
                        <span>
                          当前: {goal.currentValue}
                          {goal.unit}
                        </span>
                        <span>
                          目标: {goal.targetValue}
                          {goal.unit}
                        </span>
                      </div>

                      {/* Progress Controls */}
                      <div className="flex gap-2 mb-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleProgressUpdate(
                              goal.id,
                              goal.currentValue - 1
                            )
                          }
                          disabled={goal.currentValue <= 0}
                        >
                          -1
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleProgressUpdate(
                              goal.id,
                              goal.currentValue + 1
                            )
                          }
                          disabled={isComplete}
                        >
                          +1
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleProgressUpdate(
                              goal.id,
                              goal.currentValue + 10
                            )
                          }
                          disabled={isComplete}
                        >
                          +10
                        </Button>
                      </div>

                      {/* Sub Tasks */}
                      <div className="space-y-2">
                        {goal.subTasks.map((subTask) => (
                          <div
                            key={subTask.id}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={subTask.completed}
                              onChange={() =>
                                toggleSubTask(goal.id, subTask.id)
                              }
                              className="w-4 h-4 accent-[var(--color-accent-terracotta)]"
                            />
                            <span
                              className={
                                subTask.completed
                                  ? 'line-through text-[var(--color-text-muted)]'
                                  : ''
                              }
                            >
                              {subTask.title}
                            </span>
                          </div>
                        ))}

                        {/* Add Sub Task */}
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="添加子任务..."
                            className="flex-1 px-3 py-1 text-sm rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                if (input.value.trim()) {
                                  addSubTask(goal.id, input.value)
                                  input.value = ''
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Celebration Animation */}
                  <AnimatePresence>
                    {showCelebration === goal.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-card)] bg-opacity-90 rounded-[var(--radius-md)]"
                      >
                        <div className="text-center">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 0.5, repeat: 2 }}
                            className="text-6xl mb-4"
                          >
                            🎉
                          </motion.div>
                          <h3 className="text-2xl font-bold text-[var(--color-accent-terracotta)]">
                            恭喜完成！
                          </h3>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
