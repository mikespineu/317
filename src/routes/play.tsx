import { Suspense, lazy } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'

// three.js touches browser APIs, so the game is loaded on the client only.
const Game = lazy(() => import('#/game/Game'))

export const Route = createFileRoute('/play')({ component: Play })

function Play() {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <Game />
      </Suspense>
    </ClientOnly>
  )
}
