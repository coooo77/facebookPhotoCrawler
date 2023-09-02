'use strict'
import readline from 'readline'

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

  wait: (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
}
