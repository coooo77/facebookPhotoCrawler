'use strict'
import fs from 'fs'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import config from '../config.json'

import helper from '../utils/helper'
import fileSys from '../utils/fileSys'
import FetchPhoto from '../utils/fetchPhoto'

import type { Browser, Page } from 'puppeteer'
import type { UserConfig } from '../types/config'
import type { ParentPhotoData, PhotoInfo } from '../types/photo'

puppeteer.use(StealthPlugin())

const userConfig = config as UserConfig

const maxRetry = 10
const retryLimit = Number(userConfig.taskRetryLimit)
const limit = 0 < retryLimit && retryLimit <= maxRetry ? retryLimit : maxRetry
const taskRetryWaitSec = Number(userConfig.taskRetryWaitSec)
const retryWaitSec = taskRetryWaitSec <= 0 ? 5 : taskRetryWaitSec

let page: Page
let browser: Browser
let retryCount = 0
let currentUrl = ''
let fetchPhotoInstance: FetchPhoto | null = null
let photoData: Map<string, PhotoInfo> = new Map()

async function intervalTask() {
  if (!currentUrl) throw new Error('no current url provided')

  fetchPhotoInstance = new FetchPhoto({
    page,
    photoData,
    targetUrl: currentUrl,
  })

  try {
    await fetchPhotoInstance.process()
  } catch (error) {
    console.log('[intervalTask error]')
    if (error) console.error(error)

    const photoFetched = Array.from(photoData).at(-1)
    if (photoFetched?.[1]?.imgUrl) currentUrl = photoFetched?.[1].url

    fetchPhotoInstance = null

    const shouldRetry = ++retryCount <= limit
    if (shouldRetry) {
      console.log(`[intervalTask error] wait for ${retryWaitSec} sec, retry count: ${retryCount} / ${limit}`)
      await helper.wait(retryWaitSec)

      await intervalTask()
    } else {
      await browser.close()

      throw new Error('[intervalTask error] Crawler failed due to reach limit')
    }
  }
}

async function checkCookieInjection(currentPage: Page) {
  if (!fs.existsSync(fileSys.cookiePath)) return

  const cookies = fileSys.getJSONFile<any[]>(fileSys.cookiePath)
  if (!cookies || cookies?.length === 0) return

  for (const cookie of cookies) {
    await currentPage.setCookie(cookie)
  }
}

function sendFailLog(from: string) {
  process.send?.({ currentUrl, photoData: Object.fromEntries(photoData.entries()) })
  console.log('send failLog from', from)
}

async function fetchPhotoMain() {
  try {
    browser = await puppeteer.launch(userConfig.puppeteerConfig)

    page = await browser.newPage()
    await checkCookieInjection(page)
    await page.setDefaultNavigationTimeout(0)
    await page.setViewport({ width: 1920, height: 1080 })

    await intervalTask()

    await browser.close()
  } catch (error) {
    console.log('[fetchPhotoMain error]')
    console.error(error)
    sendFailLog('fetchPhotoMain')

    throw error
  }
}

process.once('message', (message: ParentPhotoData) => {
  currentUrl = message.currentUrl
  photoData = new Map(Object.entries(message.photoData))

  fetchPhotoMain()
})

process.on('exit', (code) => {
  console.log(`exit code: ${code}, targetUrl: ${currentUrl}`)

  if (code === 0 || !currentUrl) return

  sendFailLog('exit')
})

process.on('SIGINT', () => {
  fileSys.saveFailLog(currentUrl, photoData)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.log('[script uncaughtException]')
  console.error(error)
  throw error
})

process.on('unhandledRejection', (error) => {
  console.log('[script unhandledRejection]')
  console.error(error)
  throw error
})
