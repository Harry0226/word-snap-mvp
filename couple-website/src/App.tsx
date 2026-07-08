import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useStore } from './store/useStore'
import Onboarding from './components/shared/Onboarding'

function App() {
  const { isOnboarded } = useStore()

  return (
    <>
      {!isOnboarded && <Onboarding />}
      <RouterProvider router={router} />
    </>
  )
}

export default App
