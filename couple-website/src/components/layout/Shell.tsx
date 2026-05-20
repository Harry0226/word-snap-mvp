import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import DataManager from '../shared/DataManager'

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/anniversary', label: '纪念日', icon: '💕' },
  { path: '/interaction', label: '互动', icon: '💬' },
  { path: '/goals', label: '目标', icon: '🎯' },
  { path: '/gallery', label: '相册', icon: '📸' },
  { path: '/games', label: '游戏', icon: '🎮' },
]

export default function Shell() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 md:ml-64">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto px-4 py-6"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-surface-elevated)] border-t border-[var(--color-surface-secondary)] z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 h-full rounded-[var(--radius-sm)] transition-all duration-300 ${
                  isActive
                    ? 'text-[var(--color-accent-terracotta)] bg-[var(--color-surface-card)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-[var(--color-surface-elevated)] border-r border-[var(--color-surface-secondary)] flex-col z-50">
        {/* Logo / Header */}
        <div className="p-6 border-b border-[var(--color-surface-secondary)]">
          <h1 className="text-2xl font-bold text-[var(--color-accent-terracotta)]" style={{ fontFamily: 'var(--font-display)' }}>
            💑 我们的故事
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">记录爱的每一天</p>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-[var(--radius-sm)] transition-all duration-300 ${
                  isActive
                    ? 'text-[var(--color-accent-terracotta)] bg-[var(--color-surface-card)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-surface-secondary)]">
          <DataManager />
          <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">
            用爱记录每一天 ❤️
          </p>
        </div>
      </nav>
    </div>
  )
}
