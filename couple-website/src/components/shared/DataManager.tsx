import { motion } from 'framer-motion'
import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import Button from './Button'

export default function DataManager() {
  const { exportData, importData } = useStore()
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `couple-website-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      importData(text)
      setImportStatus('success')
      setTimeout(() => setImportStatus('idle'), 3000)
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus('error')
      setTimeout(() => setImportStatus('idle'), 3000)
    }
  }

  return (
    <div className="space-y-4">
      <h3
        className="text-lg font-semibold text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        数据管理
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Export */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-[var(--color-surface-card)] rounded-[var(--radius-md)] p-4 text-center shadow-[var(--shadow-sm)]"
        >
          <div className="text-3xl mb-2">📤</div>
          <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
            导出数据
          </h4>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            备份你们的所有数据
          </p>
          <Button size="sm" onClick={handleExport}>
            导出
          </Button>
        </motion.div>

        {/* Import */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-[var(--color-surface-card)] rounded-[var(--radius-md)] p-4 text-center shadow-[var(--shadow-sm)]"
        >
          <div className="text-3xl mb-2">📥</div>
          <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
            导入数据
          </h4>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            恢复之前备份的数据
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            导入
          </Button>
        </motion.div>
      </div>

      {/* Import Status */}
      {importStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-[var(--radius-sm)] text-center ${
            importStatus === 'success'
              ? 'bg-[var(--color-accent-sage)] bg-opacity-20 text-[var(--color-accent-moss)]'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {importStatus === 'success' ? '✓ 数据导入成功' : '✕ 导入失败，请检查文件格式'}
        </motion.div>
      )}
    </div>
  )
}
