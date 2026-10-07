import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: TitleScreen })

function TitleScreen() {
  return (
    <main className="relative grid min-h-dvh place-content-center justify-items-center gap-6 overflow-x-clip bg-indigo p-4 text-center">
      {/* The moon from the night prints, with the title printed over it. */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 size-[min(78vmin,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-paper bg-[image:var(--paper-grain)]"
      />
      <h1 className="relative font-display text-[clamp(3.5rem,min(18vw,22vh),10rem)] leading-none tracking-[0.04em] text-ink [text-shadow:0.04em_0.04em_0_var(--color-vermilion)]">
        3.17
      </h1>
      <p className="print-paper relative px-4 py-1.5 font-display text-base italic">
        The clock stopped. The house remembers.
      </p>
      <section className="print-paper relative max-w-md px-6 py-4 text-left">
        <h2 className="mb-2 font-display text-sm font-bold tracking-[0.3em] text-vermilion uppercase">
          Your task
        </h2>
        <ol className="grid gap-2 font-display text-base">
          <li className="flex gap-3">
            <span className="grid size-6 flex-none place-items-center border-2 border-ink bg-vermilion text-sm font-bold text-paper">
              1
            </span>
            Find the way out of the room.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 flex-none place-items-center border-2 border-ink bg-vermilion text-sm font-bold text-paper">
              2
            </span>
            Photograph the ghosts to prove they exist.
          </li>
        </ol>
      </section>
      <Link
        to="/play"
        className="relative mt-4 border-2 border-ink bg-vermilion px-10 py-3 font-display text-lg tracking-[0.2em] text-paper uppercase no-underline shadow-[0.2em_0.2em_0_var(--color-ink)] transition-transform hover:bg-saffron hover:text-ink active:translate-x-[0.15em] active:translate-y-[0.15em] active:shadow-[0.05em_0.05em_0_var(--color-ink)]"
      >
        Enter
      </Link>
    </main>
  )
}
