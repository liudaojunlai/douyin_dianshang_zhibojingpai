const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'

export const logger = {
  info: (msg: string, ...args: any[]) => {
    if (isDev) console.log(`[INFO] ${msg}`, ...args)
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${msg}`, ...args)
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${msg}`, ...args)
  },
}
