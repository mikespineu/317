import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { useLang } from '#/i18n'
import { detectLang } from '#/i18n/detect'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  // The request's language, for everything rendered on the server.
  beforeLoad: () => ({ lang: detectLang() }),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: '3.17',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const lang = useLang()
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
