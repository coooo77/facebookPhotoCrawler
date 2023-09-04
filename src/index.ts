import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import config from './config.json'

import helper from './utils/helper'
import fileSys from './utils/fileSys'
import FetchPhoto from './utils/fetchPhoto'

import type { Browser, Page } from 'puppeteer'
import type { PhotoInfo } from './types/photo'
import type { FailLog, UserConfig } from './types/config'

puppeteer.use(StealthPlugin())

const userConfig = config as UserConfig
const failLogPath = path.join(__dirname, '..', 'fail.json')
const dataFolder = path.join(__dirname, '..', fileSys.getDataSavePath())

let page: Page
let tryCount = 0
let browser: Browser
let targetUrl = userConfig.destination
let photos: Map<string, PhotoInfo> = new Map()
let fetchPhotoInstance: FetchPhoto | null = null

async function checkIfFail() {
  if (!fs.existsSync(failLogPath)) return

  const failLog = fileSys.getJSONFile<FailLog>(failLogPath)
  if (!failLog) return

  const msg = 'crawler fail to previous work, type "yes" if you want to resume it. '
  const result = await helper.customPrompt(msg)()

  if (result !== 'yes') return

  if (!failLog.currentUrl) throw new Error('no target URL provided')

  targetUrl = failLog.currentUrl
  photos = new Map(Object.entries(failLog.photoData))
}

function injectWorkLogJson() {
  if (!userConfig.workLogPath || !fs.existsSync(userConfig.workLogPath)) return

  const workLogJson = fileSys.getJSONFile<Record<string, PhotoInfo>>(userConfig.workLogPath)
  if (!workLogJson) return

  photos = new Map(Object.entries(workLogJson))
}

async function intervalTask() {
  fetchPhotoInstance = new FetchPhoto({
    page,
    photos,
    targetUrl,
    dataFolder,
  })

  try {
    await fetchPhotoInstance.process()
  } catch (error) {
    console.error(error)

    const photoFetched = Array.from(photos).at(-1)
    if (photoFetched && photoFetched?.[1]?.imgUrl) targetUrl = photoFetched[1].imgUrl
    fetchPhotoInstance = null

    const limit = Number(userConfig.retryLimit) <= 120 ? Number(userConfig.retryLimit) : 120
    const shouldRetry = limit > 0 && ++tryCount <= limit

    if (shouldRetry) {
      let isInternetWorking = await helper.checkInternetConnection()

      while (!isInternetWorking) {
        await helper.wait(60)
        isInternetWorking = await helper.checkInternetConnection()
      }

      await intervalTask()
    } else {
      await browser.close()

      throw new Error('Crawler failed due to reach limit')
    }
  }
}

async function main() {
  try {
    injectWorkLogJson()
    await checkIfFail()

    browser = await puppeteer.launch(userConfig.puppeteerConfig)
    page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)
    await page.setViewport({ width: 1920, height: 1080 })
    await intervalTask()

    await browser.close()

    if (fs.existsSync(failLogPath)) fs.unlinkSync(failLogPath)
  } catch (error) {
    console.log('[main process error]')
    console.error(error)
  }
}

main()

process.on('exit', (code) => {
  console.log(`exit code: ${code}, targetUrl: ${targetUrl}`)
  if (code === 0 || !targetUrl) return

  const photoData = Object.fromEntries(photos.entries())
  const data = { currentUrl: targetUrl, photoData }

  fileSys.saveJSONFile(failLogPath, data)
})
