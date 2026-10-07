import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: TitleScreen })

function TitleScreen() {
  return (
    <main className="title-screen">
      <h1>3.17</h1>
      <p>The clock stopped. The house remembers.</p>
      <Link to="/play" className="play-link">
        Enter
      </Link>
    </main>
  )
}
