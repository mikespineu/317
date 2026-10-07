import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: TitleScreen })

function TitleScreen() {
  return (
    <main className="grid min-h-dvh place-content-center gap-4 p-4 text-center">
      <h1 className="text-[clamp(4rem,18vw,10rem)] tracking-[0.05em] text-gold">
        3.17
      </h1>
      <p className="opacity-70">The clock stopped. The house remembers.</p>
      <Link
        to="/play"
        className="mt-4 justify-self-center rounded-full border border-current px-8 py-3 no-underline"
      >
        Enter
      </Link>
    </main>
  )
}
