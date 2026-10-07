// Debug tools (leva panel, overlays, stats) are enabled by ?debug in the URL,
// in dev and in production builds alike, so they work on the phone too.
export const DEBUG = new URLSearchParams(window.location.search).has('debug')
