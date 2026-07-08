import { createBrowserRouter } from 'react-router-dom'
import Shell from './components/layout/Shell'
import HomePage from './features/home/HomePage'
import AnniversaryPage from './features/anniversary/AnniversaryPage'
import InteractionPage from './features/interaction/InteractionPage'
import GoalsPage from './features/goals/GoalsPage'
import GalleryPage from './features/gallery/GalleryPage'
import GamesPage from './features/games/GamesPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Shell />,
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: 'anniversary',
          element: <AnniversaryPage />,
        },
        {
          path: 'interaction',
          element: <InteractionPage />,
        },
        {
          path: 'goals',
          element: <GoalsPage />,
        },
        {
          path: 'gallery',
          element: <GalleryPage />,
        },
        {
          path: 'games',
          element: <GamesPage />,
        },
      ],
    },
  ],
  {
    basename: '/couple-website',
  }
)
