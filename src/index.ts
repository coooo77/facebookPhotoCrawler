import path from 'path'
import download from 'image-downloader'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import userConfig from './config.json'

import helper from './utils/helper'
import fileSys from './utils/fileSys'
import type { Browser, Page } from 'puppeteer'

puppeteer.use(StealthPlugin())

let page: Page
let browser: Browser
let isFetchNextImg = false
const dataFolder = path.join(__dirname, '..', fileSys.getDataSavePath())

const selectors = {
  firstImg: 'a > img',
  photoImg: 'img[data-visualcompletion="media-vc-image"]',
  readMore: '[role="complementary"] span [role="button"]',
  complementary: '[role="complementary"] div.xyinxu5.x4uap5.x1g2khh7.xkhd6sd > span',
  nextImgButton: '[aria-label="Next photo"]',
}

async function mainProcess() {
  browser = await puppeteer.launch(userConfig.puppeteerConfig)
  page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.goto(userConfig.destination)
  await helper.wait(5)

  do {
    const { fbid, isExist } = await processPhoto()
    await clickNextPage(fbid)
    isFetchNextImg = isExist
  } while (!isFetchNextImg)

  exportHandleLog()

  await browser.close()
}

function getFbid() {
  return new URL(page.url()).searchParams.get('fbid')
}

async function clickReadMore() {
  const haveReadMore = await page.evaluate((s) => {
    const readMoreBtn = document.querySelector(s.readMore) as HTMLElement
    if (readMoreBtn && !readMoreBtn.innerHTML.includes('img')) readMoreBtn.click()
    return Boolean(readMoreBtn)
  }, selectors)

  if (haveReadMore) await helper.wait(0.5)
}

interface PhotoInfo {
  url: string
  imgUrl: string
  complementary: string
  exportPhotoName: string
}
const photos: Map<string, PhotoInfo> = new Map()
async function fetchPhotoInfo() {
  await clickReadMore()

  const { imgUrl, complementary } = await page.evaluate((s) => {
    const img = document.querySelector(s.photoImg) as HTMLImageElement
    const complementary = document.querySelector(s.complementary) as HTMLElement

    return {
      imgUrl: img.src,
      complementary: complementary?.innerText,
    }
  }, selectors)

  return {
    fbid: getFbid(),
    imgUrl,
    complementary,
  }
}

async function processPhoto() {
  const { imgUrl, complementary, fbid } = await fetchPhotoInfo()

  const isExist = Boolean(fbid && photos.get(fbid))
  if (isExist) return { fbid, isExist }

  const exportPhotoName = fbid || ''

  await download.image({
    url: imgUrl,
    dest: path.join(dataFolder, `${exportPhotoName}.jpg`),
  })

  if (userConfig.screenshotWeb) {
    await page.screenshot({
      path: path.join(dataFolder, `${exportPhotoName}_screenshot.jpg`),
    })
  }

  if (fbid) {
    photos.set(fbid, {
      url: page.url(),
      imgUrl,
      complementary,
      exportPhotoName,
    })
  }

  return { fbid, isExist }
}

async function clickNextPage(fbid: string | null) {
  let id

  do {
    await page.evaluate((s) => {
      const buttons = document.querySelector(s.nextImgButton)
      const nextBtn = buttons as HTMLLIElement
      nextBtn.click()
    }, selectors)

    id = getFbid()

    await helper.wait(0.75)
  } while (id === fbid)
}

function exportHandleLog() {
  const data = Object.fromEntries(photos.entries())
  const filePath = path.join(dataFolder, `${new Date().getTime()}.json`)
  fileSys.saveJSONFile(filePath, data)
}

mainProcess()
