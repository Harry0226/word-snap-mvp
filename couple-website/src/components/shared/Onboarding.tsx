import { motion } from 'framer-motion'
import { useState } from 'react'
import { useStore, type CoupleProfile } from '../../store/useStore'
import Button from './Button'

const steps = [
  {
    title: '欢迎来到我们的故事',
    description: '记录你们的甜蜜时光，让爱永恒',
    icon: '💑',
  },
  {
    title: '纪念日',
    description: '记录重要日期，再也不会忘记',
    icon: '💕',
  },
  {
    title: '日常互动',
    description: '留言板、心情日记、愿望清单',
    icon: '💬',
  },
  {
    title: '共同目标',
    description: '一起努力，实现梦想',
    icon: '🎯',
  },
  {
    title: '相册',
    description: '珍藏美好回忆',
    icon: '📸',
  },
  {
    title: '小游戏',
    description: '增进感情的趣味互动',
    icon: '🎮',
  },
]

export default function Onboarding() {
  const { setProfile, setOnboarded } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    partner1Name: '',
    partner2Name: '',
    relationshipStartDate: '',
  })

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setShowForm(true)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.partner1Name || !formData.partner2Name || !formData.relationshipStartDate) {
      return
    }

    const profile: CoupleProfile = {
      partner1Name: formData.partner1Name,
      partner2Name: formData.partner2Name,
      relationshipStartDate: formData.relationshipStartDate,
      anniversaryDate: formData.relationshipStartDate,
    }

    setProfile(profile)
    setOnboarded(true)
  }

  if (showForm) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[var(--color-surface-primary)] flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-8 max-w-md w-full shadow-[var(--shadow-lg)]"
        >
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">💑</div>
            <h2
              className="text-2xl font-bold text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              开始你们的故事
            </h2>
            <p className="text-[var(--color-text-muted)] mt-2">
              填写基本信息，开始记录美好时光
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                我的名字
              </label>
              <input
                type="text"
                value={formData.partner1Name}
                onChange={(e) =>
                  setFormData({ ...formData, partner1Name: e.target.value })
                }
                placeholder="输入你的名字"
                className="w-full px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                TA的名字
              </label>
              <input
                type="text"
                value={formData.partner2Name}
                onChange={(e) =>
                  setFormData({ ...formData, partner2Name: e.target.value })
                }
                placeholder="输入TA的名字"
                className="w-full px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                在一起的日期
              </label>
              <input
                type="date"
                value={formData.relationshipStartDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    relationshipStartDate: e.target.value,
                  })
                }
                className="w-full px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                返回
              </Button>
              <Button type="submit" className="flex-1">
                开始记录
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )
  }

  const currentStepData = steps[currentStep]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[var(--color-surface-primary)] flex items-center justify-center p-4 z-50"
    >
      <motion.div
        key={currentStep}
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -50, opacity: 0 }}
        className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-8 max-w-md w-full shadow-[var(--shadow-lg)] text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-6xl mb-6"
        >
          {currentStepData.icon}
        </motion.div>

        <h2
          className="text-2xl font-bold text-[var(--color-text-primary)] mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {currentStepData.title}
        </h2>

        <p className="text-[var(--color-text-muted)] mb-8">
          {currentStepData.description}
        </p>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-[var(--color-accent-terracotta)] w-6'
                  : 'bg-[var(--color-surface-secondary)]'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              variant="secondary"
              onClick={handleBack}
              className="flex-1"
            >
              上一步
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1">
            {currentStep === steps.length - 1 ? '开始设置' : '下一步'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
