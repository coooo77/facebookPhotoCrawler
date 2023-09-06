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
}
