import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

// Database Schema
interface CoupleDB extends DBSchema {
  photos: {
    key: string
    value: {
      id: string
      albumId: string
      data: string
      caption?: string
      date: string
      location?: string
    }
  }
  albums: {
    key: string
    value: {
      id: string
      title: string
      coverPhotoId?: string
      createdAt: string
    }
  }
}

// Database Name
const DB_NAME = 'couple-website-db'
const DB_VERSION = 1

// Get Database Instance
async function getDB(): Promise<IDBPDatabase<CoupleDB>> {
  return openDB<CoupleDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create photos store
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' })
      }

      // Create albums store
      if (!db.objectStoreNames.contains('albums')) {
        db.createObjectStore('albums', { keyPath: 'id' })
      }
    },
  })
}

// Photo Operations
export async function addPhoto(photo: CoupleDB['photos']['value']): Promise<void> {
  const db = await getDB()
  await db.put('photos', photo)
}

export async function getPhoto(id: string): Promise<CoupleDB['photos']['value'] | undefined> {
  const db = await getDB()
  return db.get('photos', id)
}

export async function getAllPhotos(): Promise<CoupleDB['photos']['value'][]> {
  const db = await getDB()
  return db.getAll('photos')
}

export async function getPhotosByAlbum(albumId: string): Promise<CoupleDB['photos']['value'][]> {
  const db = await getDB()
  const allPhotos = await db.getAll('photos')
  return allPhotos.filter((photo) => photo.albumId === albumId)
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('photos', id)
}

// Album Operations
export async function addAlbum(album: CoupleDB['albums']['value']): Promise<void> {
  const db = await getDB()
  await db.put('albums', album)
}

export async function getAlbum(id: string): Promise<CoupleDB['albums']['value'] | undefined> {
  const db = await getDB()
  return db.get('albums', id)
}

export async function getAllAlbums(): Promise<CoupleDB['albums']['value'][]> {
  const db = await getDB()
  return db.getAll('albums')
}

export async function deleteAlbum(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('albums', id)
}

// Photo Compression
export async function compressPhoto(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        // Draw image
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', quality)
        resolve(base64)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Export all data
export async function exportAllData(): Promise<string> {
  const db = await getDB()
  const photos = await db.getAll('photos')
  const albums = await db.getAll('albums')

  return JSON.stringify({
    photos,
    albums,
    exportedAt: new Date().toISOString(),
  })
}

// Import data
export async function importAllData(data: string): Promise<void> {
  try {
    const parsed = JSON.parse(data)
    const db = await getDB()

    // Clear existing data
    const tx = db.transaction(['photos', 'albums'], 'readwrite')
    await Promise.all([
      tx.objectStore('photos').clear(),
      tx.objectStore('albums').clear(),
      tx.done,
    ])

    // Import new data
    if (parsed.photos) {
      const tx = db.transaction('photos', 'readwrite')
      for (const photo of parsed.photos) {
        await tx.store.put(photo)
      }
      await tx.done
    }

    if (parsed.albums) {
      const tx = db.transaction('albums', 'readwrite')
      for (const album of parsed.albums) {
        await tx.store.put(album)
      }
      await tx.done
    }
  } catch (error) {
    console.error('Failed to import data:', error)
    throw error
  }
}
