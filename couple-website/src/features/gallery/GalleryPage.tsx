import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef } from 'react'
import { useStore, type Album, type Photo } from '../../store/useStore'
import { compressPhoto, generateId } from '../../lib/storage'
import Button from '../../components/shared/Button'
import Card from '../../components/shared/Card'
import EmptyState from '../../components/shared/EmptyState'

export default function GalleryPage() {
  const { albums, photos, addAlbum, addPhoto, deletePhoto } = useStore()
  const [showAlbumForm, setShowAlbumForm] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [albumTitle, setAlbumTitle] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoLocation, setPhotoLocation] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreateAlbum = (e: React.FormEvent) => {
    e.preventDefault()
    if (!albumTitle.trim()) return

    const newAlbum: Album = {
      id: generateId(),
      title: albumTitle,
      createdAt: new Date().toISOString(),
    }

    addAlbum(newAlbum)
    setAlbumTitle('')
    setShowAlbumForm(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const compressed = await compressPhoto(file)
      setPreviewPhoto(compressed)
    } catch (error) {
      console.error('Failed to compress photo:', error)
    }
  }

  const handleSavePhoto = () => {
    if (!previewPhoto) return

    const newPhoto: Photo = {
      id: generateId(),
      albumId: selectedAlbum || 'default',
      data: previewPhoto,
      caption: photoCaption,
      date: new Date().toISOString(),
      location: photoLocation,
    }

    addPhoto(newPhoto)
    setPreviewPhoto(null)
    setPhotoCaption('')
    setPhotoLocation('')
    setShowPhotoUpload(false)
  }

  const filteredPhotos = selectedAlbum
    ? photos.filter((p) => p.albumId === selectedAlbum)
    : photos

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
          📸 相册
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAlbumForm(!showAlbumForm)}>
            + 新建相册
          </Button>
          <Button onClick={() => setShowPhotoUpload(!showPhotoUpload)}>
            + 上传照片
          </Button>
        </div>
      </div>

      {/* Create Album Form */}
      <AnimatePresence>
        {showAlbumForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <form onSubmit={handleCreateAlbum} className="flex gap-2">
                <input
                  type="text"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  placeholder="相册名称"
                  className="flex-1 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                  required
                />
                <Button type="submit">创建</Button>
                <Button variant="secondary" onClick={() => setShowAlbumForm(false)}>
                  取消
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Upload Form */}
      <AnimatePresence>
        {showPhotoUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <div className="space-y-4">
                {/* Album Selector */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    选择相册
                  </label>
                  <select
                    value={selectedAlbum || ''}
                    onChange={(e) => setSelectedAlbum(e.target.value || null)}
                    className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                  >
                    <option value="">默认相册</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Input */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    选择照片
                  </Button>
                </div>

                {/* Preview */}
                {previewPhoto && (
                  <div className="relative">
                    <img
                      src={previewPhoto}
                      alt="Preview"
                      className="w-full max-h-64 object-contain rounded-[var(--radius-md)]"
                    />
                    <button
                      onClick={() => setPreviewPhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Caption and Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      描述
                    </label>
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder="添加描述..."
                      className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      地点
                    </label>
                    <input
                      type="text"
                      value={photoLocation}
                      onChange={(e) => setPhotoLocation(e.target.value)}
                      placeholder="添加地点..."
                      className="w-full px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-elevated)] border border-[var(--color-surface-secondary)] focus:outline-none focus:border-[var(--color-accent-terracotta)]"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={handleSavePhoto} disabled={!previewPhoto}>
                    保存照片
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowPhotoUpload(false)
                      setPreviewPhoto(null)
                    }}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Albums */}
      <section>
        <h2
          className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          相册集
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Default Album */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedAlbum(null)}
            className={`bg-[var(--color-surface-card)] rounded-[var(--radius-md)] p-6 text-center shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer ${
              !selectedAlbum ? 'ring-2 ring-[var(--color-accent-terracotta)]' : ''
            }`}
          >
            <div className="text-4xl mb-3">📷</div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">全部照片</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{photos.length} 张</p>
          </motion.div>

          {/* User Albums */}
          {albums.map((album) => {
            const albumPhotos = photos.filter((p) => p.albumId === album.id)
            return (
              <motion.div
                key={album.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedAlbum(album.id)}
                className={`bg-[var(--color-surface-card)] rounded-[var(--radius-md)] p-6 text-center shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer ${
                  selectedAlbum === album.id
                    ? 'ring-2 ring-[var(--color-accent-terracotta)]'
                    : ''
                }`}
              >
                <div className="text-4xl mb-3">📁</div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  {album.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {albumPhotos.length} 张
                </p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Photo Grid */}
      <section>
        <h2
          className="text-2xl font-semibold mb-4 text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {selectedAlbum
            ? albums.find((a) => a.id === selectedAlbum)?.title || '相册'
            : '全部照片'}
        </h2>

        {filteredPhotos.length === 0 ? (
          <EmptyState
            icon="📸"
            title="还没有照片"
            description="上传你们的第一张照片吧！"
            action={
              <Button onClick={() => setShowPhotoUpload(true)}>上传照片</Button>
            }
          />
        ) : (
          <div className="columns-2 md:columns-3 gap-4 space-y-4">
            {filteredPhotos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="break-inside-avoid"
              >
                <div className="rounded-[var(--radius-md)] overflow-hidden shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow group relative">
                  <img
                    src={photo.data}
                    alt={photo.caption || 'Photo'}
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-end">
                    <div className="p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity w-full">
                      {photo.caption && (
                        <p className="font-medium text-sm">{photo.caption}</p>
                      )}
                      {photo.location && (
                        <p className="text-xs opacity-80">📍 {photo.location}</p>
                      )}
                      <p className="text-xs opacity-80">
                        {new Date(photo.date).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  )
}
