import type { LiveProvider, LiveEvent } from '@refinedev/core'
import { getSocket } from '@/lib/socket'

export const liveProvider: LiveProvider = {
  subscribe: ({ channel, callback }) => {
    const socket = getSocket()

    const handler = (event: LiveEvent) => {
      callback(event)
    }

    socket.on(channel, handler)

    return {
      unsubscribe: () => {
        socket.off(channel, handler)
      },
    }
  },

  unsubscribe: (subscription) => {
    subscription.unsubscribe()
  },

  publish: (event) => {
    const socket = getSocket()
    socket.emit(event.channel!, event)
  },
}
