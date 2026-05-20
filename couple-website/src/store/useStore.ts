import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types
export interface CoupleProfile {
  partner1Name: string
  partner2Name: string
  relationshipStartDate: string
  anniversaryDate: string
  avatar1?: string
  avatar2?: string
}

export interface Anniversary {
  id: string
  title: string
  date: string
  isRecurring: boolean
  icon?: string
  photos?: string[]
}

export interface LoveLetter {
  id: string
  from: 'partner1' | 'partner2'
  content: string
  createdAt: string
  isRead: boolean
}

export interface MoodEntry {
  partner: 'partner1' | 'partner2'
  date: string
  mood: 'happy' | 'love' | 'calm' | 'sad' | 'angry' | 'excited'
}

export interface Goal {
  id: string
  title: string
  category: 'travel' | 'finance' | 'health' | 'learning' | 'home'
  targetValue: number
  currentValue: number
  unit: string
  subTasks: SubTask[]
  createdAt: string
}

export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface Photo {
  id: string
  albumId: string
  data: string
  caption?: string
  date: string
  location?: string
}

export interface Album {
  id: string
  title: string
  coverPhotoId?: string
  createdAt: string
}

export interface WishItem {
  id: string
  title: string
  priority: number
  completed: boolean
  addedBy: 'partner1' | 'partner2'
}

export interface DailyAnswer {
  id: string
  questionId: string
  partner: 'partner1' | 'partner2'
  answer: string
  date: string
}

// Store State
interface AppState {
  // Profile
  profile: CoupleProfile | null
  isOnboarded: boolean

  // Anniversaries
  anniversaries: Anniversary[]

  // Love Letters
  loveLetters: LoveLetter[]

  // Mood
  moodEntries: MoodEntry[]

  // Goals
  goals: Goal[]

  // Photos & Albums
  photos: Photo[]
  albums: Album[]

  // Wishes
  wishes: WishItem[]

  // Daily Answers
  dailyAnswers: DailyAnswer[]

  // Actions
  setProfile: (profile: CoupleProfile) => void
  setOnboarded: (value: boolean) => void

  addAnniversary: (anniversary: Anniversary) => void
  updateAnniversary: (id: string, data: Partial<Anniversary>) => void
  deleteAnniversary: (id: string) => void

  addLoveLetter: (letter: LoveLetter) => void
  markLetterRead: (id: string) => void

  addMoodEntry: (entry: MoodEntry) => void

  addGoal: (goal: Goal) => void
  updateGoal: (id: string, data: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  toggleSubTask: (goalId: string, subTaskId: string) => void

  addAlbum: (album: Album) => void
  addPhoto: (photo: Photo) => void
  deletePhoto: (id: string) => void

  addWish: (wish: WishItem) => void
  toggleWish: (id: string) => void
  deleteWish: (id: string) => void

  addDailyAnswer: (answer: DailyAnswer) => void

  // Export/Import
  exportData: () => string
  importData: (data: string) => void
}

// Create Store
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      profile: null,
      isOnboarded: false,
      anniversaries: [],
      loveLetters: [],
      moodEntries: [],
      goals: [],
      photos: [],
      albums: [],
      wishes: [],
      dailyAnswers: [],

      // Profile Actions
      setProfile: (profile) => set({ profile }),
      setOnboarded: (value) => set({ isOnboarded: value }),

      // Anniversary Actions
      addAnniversary: (anniversary) =>
        set((state) => ({
          anniversaries: [...state.anniversaries, anniversary],
        })),
      updateAnniversary: (id, data) =>
        set((state) => ({
          anniversaries: state.anniversaries.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        })),
      deleteAnniversary: (id) =>
        set((state) => ({
          anniversaries: state.anniversaries.filter((a) => a.id !== id),
        })),

      // Love Letter Actions
      addLoveLetter: (letter) =>
        set((state) => ({
          loveLetters: [...state.loveLetters, letter],
        })),
      markLetterRead: (id) =>
        set((state) => ({
          loveLetters: state.loveLetters.map((l) =>
            l.id === id ? { ...l, isRead: true } : l
          ),
        })),

      // Mood Actions
      addMoodEntry: (entry) =>
        set((state) => ({
          moodEntries: [...state.moodEntries, entry],
        })),

      // Goal Actions
      addGoal: (goal) =>
        set((state) => ({
          goals: [...state.goals, goal],
        })),
      updateGoal: (id, data) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...data } : g
          ),
        })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        })),
      toggleSubTask: (goalId, subTaskId) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  subTasks: g.subTasks.map((st) =>
                    st.id === subTaskId
                      ? { ...st, completed: !st.completed }
                      : st
                  ),
                }
              : g
          ),
        })),

      // Photo Actions
      addAlbum: (album) =>
        set((state) => ({
          albums: [...state.albums, album],
        })),
      addPhoto: (photo) =>
        set((state) => ({
          photos: [...state.photos, photo],
        })),
      deletePhoto: (id) =>
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== id),
        })),

      // Wish Actions
      addWish: (wish) =>
        set((state) => ({
          wishes: [...state.wishes, wish],
        })),
      toggleWish: (id) =>
        set((state) => ({
          wishes: state.wishes.map((w) =>
            w.id === id ? { ...w, completed: !w.completed } : w
          ),
        })),
      deleteWish: (id) =>
        set((state) => ({
          wishes: state.wishes.filter((w) => w.id !== id),
        })),

      // Daily Answer Actions
      addDailyAnswer: (answer) =>
        set((state) => ({
          dailyAnswers: [...state.dailyAnswers, answer],
        })),

      // Export/Import
      exportData: () => {
        const state = get()
        return JSON.stringify({
          profile: state.profile,
          anniversaries: state.anniversaries,
          loveLetters: state.loveLetters,
          moodEntries: state.moodEntries,
          goals: state.goals,
          photos: state.photos,
          albums: state.albums,
          wishes: state.wishes,
          dailyAnswers: state.dailyAnswers,
        })
      },
      importData: (data) => {
        try {
          const parsed = JSON.parse(data)
          set({
            profile: parsed.profile || null,
            anniversaries: parsed.anniversaries || [],
            loveLetters: parsed.loveLetters || [],
            moodEntries: parsed.moodEntries || [],
            goals: parsed.goals || [],
            photos: parsed.photos || [],
            albums: parsed.albums || [],
            wishes: parsed.wishes || [],
            dailyAnswers: parsed.dailyAnswers || [],
            isOnboarded: true,
          })
        } catch (error) {
          console.error('Failed to import data:', error)
        }
      },
    }),
    {
      name: 'couple-website-storage',
    }
  )
)
