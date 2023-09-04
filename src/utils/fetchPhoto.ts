'use strict'
import fs from 'fs'
import path from 'path'
import helper from './helper'
import fileSys from './fileSys'
import download from 'image-downloader'

import userConfig from '../config.json'

import type { Page } from 'puppeteer'
import type { PhotoInfo } from '../types/photo'

interface Params {
  page: Page
  targetUrl: string
  dataFolder: string
  photos: Map<string, PhotoInfo>
}

export default class FetchPhoto {
  page: Page
  targetUrl: string
  currentUrl = ''
  dataFolder: string
  isFetchNextImg = false
  photos: Map<string, PhotoInfo>

  selectors = {
    nextImgButton: '[aria-label="Next photo"]',
    preImgButton: '[aria-label="Previous photo"]',
    readMore: '[role="complementary"] span [role="button"]',
    photoImg: 'img[data-visualcompletion="media-vc-image"]',
    complementary: '[role="complementary"] div.xyinxu5.x4uap5.x1g2khh7.xkhd6sd > span',
  }

  constructor({ page, dataFolder, photos, targetUrl }: Params) {
    this.page = page
    this.photos = photos
    this.targetUrl = targetUrl
    this.dataFolder = dataFolder
  }

  async process() {
    await this.navigateToPage()

    const isContinueWork = this.photos.size !== 0
    if (isContinueWork) await this.clickNextPage(this.getFbid())

    do {
      await this.clickReadMore()
      const { fbid, isPhotoFetched } = await this.processPhoto()
      await this.clickNextPage(fbid)
      this.isFetchNextImg = !isPhotoFetched
    } while (this.isFetchNextImg)

    this.exportHandleLog()
  }

  exportHandleLog() {
    const data = Object.fromEntries(this.photos.entries())
    const filePath = path.join(this.dataFolder, `${new Date().getTime()}.json`)
    fileSys.saveJSONFile(filePath, data)
  }

  async downloadPhotos(fbid: string, imgUrl: string) {
    const photoPath = path.join(this.dataFolder, `${fbid}.jpg`)
    if (!fs.existsSync(photoPath))
      await download.image({
        dest: photoPath,
        url: imgUrl,
      })

    await helper.wait(0.5)
  }

  async clickNextPage(preFbid: string | null) {
    let id

    do {
      await this.page.evaluate((s) => {
        const nextBtn = document.querySelector(s.nextImgButton) as HTMLElement
        nextBtn?.click()
      }, this.selectors)

      id = this.getFbid()

      await helper.wait(0.5)
    } while (preFbid === id)

    if (userConfig.fullLoad) await this.navigateToPage(this.page.url())
  }

  async processPhoto() {
    const fbid = this.getFbid()

    let failCount = 0

    let fetchData = {
      imgUrl: '',
      complementary: '',
    }

    do {
      fetchData = await this.fetchPhotoInfo()

      if (++failCount <= 10) continue
      failCount = 0
      await this.navigateToPage(this.page.url())
    } while (!fetchData.imgUrl)

    const isPhotoFetched = Boolean(fbid && this.photos.get(fbid))
    if (isPhotoFetched) return { fbid, isPhotoFetched }

    const exportPhotoName = fbid || `${new Date().getTime()}_unknown_fbid`

    this.currentUrl = this.page.url()

    if (fbid) {
      this.photos.set(fbid, {
        imgUrl: fetchData.imgUrl,
        complementary: fetchData.complementary,
        url: this.page.url(),
      })

      this.downloadPhotos(fbid, fetchData.imgUrl)
    }

    if (userConfig.screenshotWeb) {
      const screenshotPath = path.join(this.dataFolder, `${exportPhotoName}_screenshot.jpg`)
      const isScreenshotExist = fs.existsSync(screenshotPath)
      if (!isScreenshotExist) await this.page.screenshot({ path: screenshotPath })
    }

    return { fbid, isPhotoFetched }
  }

  getFbid() {
    return new URL(this.page.url()).searchParams.get('fbid')
  }

  async fetchPhotoInfo() {
    const { imgUrl, complementary } = await this.page.evaluate((s) => {
      const img = document.querySelector(s.photoImg) as HTMLImageElement
      const complementary = document.querySelector(s.complementary) as HTMLElement

      return {
        imgUrl: img?.src,
        complementary: complementary?.innerText,
      }
    }, this.selectors)

    return {
      imgUrl,
      complementary,
    }
  }

  async navigateToPage(url = this.targetUrl) {
    await Promise.all([this.page.goto(url), this.page.waitForNavigation({ waitUntil: 'networkidle0' })])
  }

  async clickReadMore() {
    const haveReadMore = await this.page.evaluate((s) => {
      const readMoreBtn = document.querySelector(s.readMore) as HTMLElement
      if (readMoreBtn && !readMoreBtn.innerHTML.includes('img')) {
        readMoreBtn.click()
      }

      return Boolean(readMoreBtn)
    }, this.selectors)

    if (haveReadMore) await helper.wait(0.5)
  }
}
