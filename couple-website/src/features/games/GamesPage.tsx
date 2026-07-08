import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import Button from '../../components/shared/Button'

const quizQuestions = [
  { question: 'TA最喜欢的食物是什么？', options: ['火锅', '寿司', '烧烤', '甜点'] },
  { question: 'TA最喜欢的颜色是什么？', options: ['红色', '蓝色', '绿色', '紫色'] },
  { question: 'TA最想去的地方是哪里？', options: ['日本', '巴黎', '马尔代夫', '新西兰'] },
  { question: 'TA最喜欢的电影类型是什么？', options: ['喜剧', '爱情', '科幻', '悬疑'] },
  { question: 'TA早上起床第一件事做什么？', options: ['看手机', '喝水', '伸懒腰', '刷牙'] },
]

export default function GamesPage() {
  const { wishes } = useStore()
  const [spinning, setSpinning] = useState(false)
  const [selectedWish, setSelectedWish] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)

  // Quiz State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)

  // Memory Game State
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([])
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [memoryScore, setMemoryScore] = useState(0)

  // Initialize Memory Game
  useEffect(() => {
    const emojis = ['💕', '🌟', '🌹', '💑', '🎂', '🎉', '💍', '✈️']
    const duplicated = [...emojis, ...emojis]
    const shuffled = duplicated
      .map((emoji, index) => ({
        id: index,
        emoji,
        flipped: false,
        matched: false,
      }))
      .sort(() => Math.random() - 0.5)
    setCards(shuffled)
  }, [])

  const handleSpin = () => {
    if (wishes.length === 0) return

    setSpinning(true)
    setSelectedWish(null)

    // Random rotation between 1080 and 3600 degrees
    const newRotation = rotation + 1080 + Math.random() * 2520
    setRotation(newRotation)

    setTimeout(() => {
      const randomWish = wishes[Math.floor(Math.random() * wishes.length)]
      setSelectedWish(randomWish.title)
      setSpinning(false)
    }, 3000)
  }

  const handleQuizAnswer = (answer: string) => {
    if (showResult) return

    setSelectedAnswer(answer)
    setShowResult(true)

    // For demo, randomly correct
    const isCorrect = Math.random() > 0.5
    if (isCorrect) {
      setQuizScore(quizScore + 1)
    }

    setTimeout(() => {
      if (currentQuizIndex < quizQuestions.length - 1) {
        setCurrentQuizIndex(currentQuizIndex + 1)
        setSelectedAnswer(null)
        setShowResult(false)
      } else {
        setQuizFinished(true)
      }
    }, 1500)
  }

  const resetQuiz = () => {
    setCurrentQuizIndex(0)
    setQuizScore(0)
    setQuizFinished(false)
    setSelectedAnswer(null)
    setShowResult(false)
  }

  const handleCardClick = (cardId: number) => {
    if (flippedCards.length === 2) return
    if (cards[cardId].flipped || cards[cardId].matched) return

    const newCards = [...cards]
    newCards[cardId].flipped = true
    setCards(newCards)

    const newFlipped = [...flippedCards, cardId]
    setFlippedCards(newFlipped)

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped
      if (cards[first].emoji === cards[second].emoji) {
        // Match found
        setTimeout(() => {
          const matchedCards = [...cards]
          matchedCards[first].matched = true
          matchedCards[second].matched = true
          setCards(matchedCards)
          setMemoryScore(memoryScore + 1)
          setFlippedCards([])
        }, 500)
      } else {
        // No match
        setTimeout(() => {
          const resetCards = [...cards]
          resetCards[first].flipped = false
          resetCards[second].flipped = false
          setCards(resetCards)
          setFlippedCards([])
        }, 1000)
      }
    }
  }

  const resetMemoryGame = () => {
    const emojis = ['💕', '🌟', '🌹', '💑', '🎂', '🎉', '💍', '✈️']
    const duplicated = [...emojis, ...emojis]
    const shuffled = duplicated
      .map((emoji, index) => ({
        id: index,
        emoji,
        flipped: false,
        matched: false,
      }))
      .sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setFlippedCards([])
    setMemoryScore(0)
  }

  const currentQuestion = quizQuestions[currentQuizIndex]

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
        🎮 小游戏
      </h1>

      {/* Compatibility Quiz */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h2
          className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          💑 默契测试
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-4">
          回答关于对方的问题，看看你们有多了解彼此！
        </p>

        {quizFinished ? (
          <div className="text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-6xl mb-4"
            >
              🎉
            </motion.div>
            <div className="text-4xl font-bold text-[var(--color-accent-terracotta)] mb-2">
              {quizScore}/{quizQuestions.length}
            </div>
            <p className="text-[var(--color-text-muted)] mb-4">
              {quizScore >= quizQuestions.length * 0.8
                ? '默契度超高！'
                : quizScore >= quizQuestions.length * 0.5
                ? '默契度不错！'
                : '还需要多了解对方哦！'}
            </p>
            <Button onClick={resetQuiz}>再试一次</Button>
          </div>
        ) : (
          <div>
            <div className="bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] p-6 mb-4">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">
                问题 {currentQuizIndex + 1}/{quizQuestions.length}
              </p>
              <p className="text-lg text-[var(--color-text-primary)]">
                {currentQuestion.question}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleQuizAnswer(option)}
                  disabled={showResult}
                  className={`p-3 rounded-[var(--radius-sm)] border transition-all ${
                    selectedAnswer === option
                      ? 'bg-[var(--color-accent-terracotta)] text-[var(--color-text-inverse)] border-[var(--color-accent-terracotta)]'
                      : 'bg-[var(--color-surface-card)] border-[var(--color-surface-secondary)] hover:border-[var(--color-accent-terracotta)] hover:bg-[var(--color-accent-terracotta)] hover:text-[var(--color-text-inverse)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Memory Match Game */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex justify-between items-center mb-4">
          <h2
            className="text-xl font-semibold text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            🃏 记忆翻牌
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-muted)]">
              配对: {memoryScore}/8
            </span>
            <Button size="sm" variant="secondary" onClick={resetMemoryGame}>
              重新开始
            </Button>
          </div>
        </div>
        <p className="text-[var(--color-text-secondary)] mb-4">
          翻开卡片，找到配对的表情！
        </p>
        <div className="grid grid-cols-4 gap-3">
          {cards.map((card) => (
            <motion.div
              key={card.id}
              whileHover={{ scale: card.flipped || card.matched ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCardClick(card.id)}
              className={`aspect-square rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all text-3xl ${
                card.matched
                  ? 'bg-[var(--color-accent-sage)] bg-opacity-30'
                  : card.flipped
                  ? 'bg-[var(--color-accent-clay)]'
                  : 'bg-[var(--color-accent-sage)]'
              }`}
            >
              {card.flipped || card.matched ? card.emoji : '❓'}
            </motion.div>
          ))}
        </div>
        {memoryScore === 8 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            <p className="text-lg font-semibold text-[var(--color-accent-terracotta)]">
              🎉 恭喜完成！
            </p>
          </motion.div>
        )}
      </section>

      {/* Bucket List Spinner */}
      <section className="bg-[var(--color-surface-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
        <h2
          className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          🎡 转盘选择
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-4">
          不知道做什么？让转盘帮你决定！
        </p>

        {wishes.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p>请先在互动页面添加愿望清单</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative w-48 h-48 mx-auto mb-6">
              {/* Spinner Background */}
              <motion.div
                animate={{ rotate: rotation }}
                transition={{ duration: 3, ease: 'easeOut' }}
                className="w-full h-full rounded-full bg-gradient-to-br from-[var(--color-accent-sage)] via-[var(--color-accent-clay)] to-[var(--color-accent-terracotta)] flex items-center justify-center shadow-[var(--shadow-lg)]"
              >
                <div className="w-44 h-44 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                  <div className="text-center">
                    {selectedWish ? (
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-semibold text-[var(--color-accent-terracotta)] px-4"
                      >
                        {selectedWish}
                      </motion.p>
                    ) : (
                      <p className="text-[var(--color-text-muted)]">?</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Pointer */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
                <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-[var(--color-accent-terracotta)]" />
              </div>
            </div>

            <Button onClick={handleSpin} disabled={spinning}>
              {spinning ? '转动中...' : '开始转盘'}
            </Button>
          </div>
        )}
      </section>
    </motion.div>
  )
}
