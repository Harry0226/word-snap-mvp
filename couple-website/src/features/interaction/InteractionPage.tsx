import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useStore, type LoveLetter, type WishItem } from '../../store/useStore'
import Button from '../../components/shared/Button'
import EmptyState from '../../components/shared/EmptyState'

const dailyQuestions = [
  '你最喜欢我们一起做的什么事情？',
  '如果我们可以去任何地方旅行，你想去哪里？',
  '你最珍惜我们之间的哪个回忆？',
  '你觉得我最可爱的时候是什么时候？',
  '如果可以用一个词形容我们的关系，你会用什么词？',
  '你最想和我一起实现的梦想是什么？',
  '你觉得我们在一起最让你感动的时刻是什么？',
  '如果时光可以倒流，你想回到我们哪一天？',
]

export default function InteractionPage() {
  const {
    loveLetters,
    addLoveLetter,
    wishes,
    addWish,
    toggleWish,
    deleteWish,
    profile,
  } = useStore()

  const [letterContent, setLetterContent] = useState('')
  const [selectedPartner, setSelectedPartner] = useState<'partner1' | 'partner2'>('partner1')
  const [wishContent, setWishContent] = useState('')
  const [currentQuestion] = useState(
    dailyQuestions[Math.floor(Math.random() * dailyQuestions.length)]
  )

  const handleSendLetter = () => {
    if (!letterContent.trim()) return

    const newLetter: LoveLetter = {
      id: Math.random().toString(36).substr(2, 9),
      from: selectedPartner,
      content: letterContent,
      createdAt: new Date().toISOString(),
      isRead: false,
    }

    addLoveLetter(newLetter)
    setLetterContent('')
  }

  const handleAddWish = () => {
    if (!wishContent.trim()) return

    const newWish: WishItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: wishContent,
      priority: wishes.length + 1,
      completed: false,
      addedBy: selectedPartner,
    }

    addWish(newWish)
    setWishContent('')
  }

  const getPartnerName = (partner: 'partner1' | 'partner2') => {
    return partner === 'partner1'
      ? profile?.partner1Name || '我'
      : profile?.partner2Name || 'TA'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <h1
        className="text-3xl font-bold text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        💬 日常互动
      </h1>

      {/* Partner Selector */}
      <div className="flex gap-3">
        <Button
          variant={selectedPartner === 'partner1' ? 'primary' : 'secondary'}
          onClick={() => setSelectedPartner('partner1')}
        >
          {getPartnerName('partner1')}
        </Button>
        <Button
          variant={selectedPartner === 'partner2' ? 'primary' : 'secondary'}
          onClick={() => setSelectedPartner('partner2')}
        >
          {getPartnerName('partner2')}
        </Button>
      </div>

      {/* Love Letter Board */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h2
          className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          💌 留言板
        </h2>

        {/* Letters List */}
        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
          {loveLetters.length === 0 ? (
            <EmptyState
              icon="💌"
              title="还没有留言"
              description="写下你的第一封情书吧！"
            />
          ) : (
            <AnimatePresence>
              {loveLetters
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((letter) => (
                  <motion.div
                    key={letter.id}
                    initial={{ opacity: 0, x: letter.from === 'partner1' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex ${
                      letter.from === 'partner1' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-[var(--radius-md)] ${
                        letter.from === 'partner1'
                          ? 'bg-[var(--color-accent-sage)] text-[var(--color-text-inverse)]'
                          : 'bg-[var(--color-accent-clay)] text-[var(--color-text-inverse)]'
                      }`}
                    >
                      <p className="handwriting text-lg">{letter.content}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs opacity-70">
                          {getPartnerName(letter.from)}
                        </p>
                        <p className="text-xs opacity-70">
                          {new Date(letter.createdAt).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          )}
        </div>

        {/* Send Letter Form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={letterContent}
            onChange={(e) => setLetterContent(e.target.value)}
            placeholder="写点什么..."
            className="flex-1 px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
            onKeyPress={(e) => e.key === 'Enter' && handleSendLetter()}
          />
          <Button onClick={handleSendLetter}>发送</Button>
        </div>
      </section>

      {/* Daily Question */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h2
          className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ❓ 每日问题
        </h2>
        <div className="bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-6 mb-4">
          <p className="text-lg text-[var(--color-text-primary)]">{currentQuestion}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="写下你的回答..."
            className="flex-1 px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
          />
          <Button>提交回答</Button>
        </div>
      </section>

      {/* Wish List */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h2
          className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ✨ 愿望清单
        </h2>

        {/* Add Wish Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={wishContent}
            onChange={(e) => setWishContent(e.target.value)}
            placeholder="添加新愿望..."
            className="flex-1 px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
            onKeyPress={(e) => e.key === 'Enter' && handleAddWish()}
          />
          <Button onClick={handleAddWish}>添加</Button>
        </div>

        {/* Wish List */}
        {wishes.length === 0 ? (
          <EmptyState
            icon="✨"
            title="还没有愿望"
            description="添加你们想一起做的事情吧！"
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {wishes
                .sort((a, b) => a.priority - b.priority)
                .map((wish) => (
                  <motion.div
                    key={wish.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center gap-3 p-3 rounded-[var(--radius-sm)] ${
                      wish.completed
                        ? 'bg-[var(--color-accent-sage)] bg-opacity-20'
                        : 'bg-[var(--color-surface-elevated)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={wish.completed}
                      onChange={() => toggleWish(wish.id)}
                      className="w-5 h-5 rounded-[var(--radius-full)] accent-[var(--color-accent-terracotta)]"
                    />
                    <span
                      className={`flex-1 ${
                        wish.completed
                          ? 'line-through text-[var(--color-text-muted)]'
                          : ''
                      }`}
                    >
                      {wish.title}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {getPartnerName(wish.addedBy)}
                    </span>
                    <button
                      onClick={() => deleteWish(wish.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </motion.div>
  )
}
