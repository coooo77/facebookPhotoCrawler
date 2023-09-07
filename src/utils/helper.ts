'use strict'
import dns from 'dns'
import readline from 'readline'
import { setTimeout as wait } from 'node:timers/promises'

export default {
  customPrompt(msg: string) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    return () =>
      new Promise<string>((resolve, reject) => {
        rl.question(msg, (reply) => {
          rl.close()
          resolve(reply)
        })
      })
  },

  wait: (seconds: number) => wait(seconds * 1000),

  checkInternetConnection(): Promise<boolean> {
    return new Promise((res) => {
      dns.resolve('www.google.com', (err) => res(!Boolean(err)))
    })
  },

  getTimeString() {
    const targetTime = new Date()
    const y = String(targetTime.getFullYear()).padStart(2, '0')
    const m = String(targetTime.getMonth() + 1).padStart(2, '0')
    const d = String(targetTime.getDate()).padStart(2, '0')
    const hr = String(targetTime.getHours()).padStart(2, '0')
    const min = String(targetTime.getMinutes()).padStart(2, '0')
    const sec = String(targetTime.getSeconds()).padStart(2, '0')

    return `${y}${m}${d}_${hr}${min}${sec}`
  },
}
