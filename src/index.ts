import fs from 'fs'
import path from 'path'
import cp from 'child_process'
import { select, confirm, isCancel } from '@clack/prompts'

import helper from './utils/helper'
import fileSys from './utils/fileSys'

import config from './config.json'

import type { PhotoInfo } from './types/photo'
import type { FailLog, UserConfig } from './types/config'

const userConfig = config as UserConfig
const retryLimit = Number(userConfig.retryLimit)
const limit = retryLimit <= 120 ? retryLimit : 120

let retryCount = 0
let currentUrl = userConfig.destination
let photoData: Map<string, PhotoInfo> = new Map()

function updateFetchInfo(failLog: FailLog) {
  currentUrl = failLog.currentUrl
  photoData = new Map(Object.entries(failLog.photoData))
}

function injectFailLog(logPath: string) {
  const failLog = fileSys.getJSONFile<FailLog>(logPath)
  if (!failLog) return console.log('can not resolve fail log data!')
  updateFetchInfo(failLog)
}

async function checkFailInjection() {
  if (!fs.existsSync(fileSys.failLogPath)) return

  const logs = fs.readdirSync(fileSys.failLogPath).filter((file) => {
    const { name, ext } = path.parse(file)
    return name.includes('fail') && ext === '.json'
  })

  if (logs.length === 0) return

  const shouldUseFailLog = await confirm({
    message: 'Fail log detected, do you want to use it?',
  })

  if (!shouldUseFailLog || isCancel(shouldUseFailLog)) return

  if (logs.length === 1) {
    const logPath = path.join(fileSys.failLogPath, logs[0])

    injectFailLog(logPath)
  } else {
    const options = logs.map((filename) => ({
      label: filename,
      value: path.join(fileSys.failLogPath, filename),
    }))

    const fileSelected = await select<typeof options, string>({
      message: 'which file to use?',
      options,
    })

    injectFailLog(fileSelected as string)
  }
}

function runScript(): Promise<void> {
  return new Promise((res, rej) => {
    const payload = JSON.stringify({ currentUrl, photoData: Object.fromEntries(photoData.entries()) })

    const child_process = cp.fork(path.join(__dirname, 'scripts', 'fetchPhotos.ts'), [payload])

    child_process.on('message', updateFetchInfo)

    child_process.on('close', (code) => {
      child_process.off('close', () => {})
      child_process.off('message', () => {})

      const closeFn = code === 0 ? res : rej
      closeFn()
    })
  })
}

function makeFailLog() {
  const failLog: FailLog = {
    currentUrl,
    photoData: Object.fromEntries(photoData.entries()),
  }

  const failLogDir = fileSys.getOrCreateDirPath('fail')
  const failFilename = `${new Date().getTime()}-fail.json`
  const failLogPath = path.join(failLogDir, failFilename)
  fileSys.saveJSONFile(failLogPath, failLog)
}

async function main() {
  try {
    await runScript()
  } catch (error) {
    if (++retryCount >= limit) {
      makeFailLog()
      throw Error('Crawler failed due to reach limit')
    } else {
      console.log('[main process error] wait 60 sec')
      await helper.wait(60)
      main()
    }
  }
}

process.on('SIGINT', () => {
  makeFailLog()
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.log('[index uncaughtException]')
  console.error(error)
})

process.on('unhandledRejection', (error) => {
  console.log('[index unhandledRejection]')
  console.error(error)
})

checkFailInjection().then(main)
