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
  photoData: Map<string, PhotoInfo>
}

export default class FetchPhoto {
  page: Page
  targetUrl: string
  isFetchNextImg = false
  photoData: Map<string, PhotoInfo>
  dataDirPath = fileSys.getOrCreateDirPath('data')

  selectors = {
    nextImgButton: '[data-name="media-viewer-nav-container"] > div:nth-child(3) [aria-label]',
    preImgButton: '[data-name="media-viewer-nav-container"] > div:nth-child(2) [aria-label]',
    readMore: '[role="complementary"] span [role="button"]',
    photoImg: 'img[data-visualcompletion="media-vc-image"]',
    complementary: '[role="complementary"] div.xyinxu5.x4uap5.x1g2khh7.xkhd6sd > span',
  }

  constructor({ page, photoData, targetUrl }: Params) {
    this.page = page
    this.photoData = photoData
    this.targetUrl = targetUrl
  }

  async process() {
    await this.navigateToPage()

    const currentFbid = this.getFbid()
    const isContinueWork = Boolean(currentFbid && this.photoData.get(currentFbid))
    if (isContinueWork) await this.clickNextPage(currentFbid)

    do {
      await this.clickReadMore()
      const { fbid, isPhotoFetched } = await this.processPhoto()
      await this.clickNextPage(fbid)
      this.isFetchNextImg = !isPhotoFetched
    } while (this.isFetchNextImg)

    this.exportHandleLog()
  }

  exportHandleLog() {
    const data = Object.fromEntries(this.photoData.entries())
    const filePath = path.join(this.dataDirPath, `${helper.getTimeString()}_work_log.json`)
    fileSys.saveJSONFile(filePath, data)
  }

  async downloadPhotos(fbid: string, imgUrl: string) {
    const photoPath = path.join(this.dataDirPath, `${fbid}.jpg`)
    if (fs.existsSync(photoPath)) return

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
      await this.page.reload({ waitUntil: 'networkidle0' })
    } while (!fetchData.imgUrl)

    const isPhotoFetched = Boolean(fbid && this.photoData.get(fbid))
    if (isPhotoFetched) return { fbid, isPhotoFetched }

    const exportPhotoName = fbid || `${new Date().getTime()}_unknown_fbid`

    if (fbid) {
      this.photoData.set(fbid, {
        imgUrl: fetchData.imgUrl,
        complementary: fetchData.complementary,
        url: this.page.url(),
      })

      this.downloadPhotos(fbid, fetchData.imgUrl)
    }

    if (userConfig.screenshotWeb) {
      const screenshotPath = path.join(this.dataDirPath, `${exportPhotoName}_screenshot.jpg`)
      const isScreenshotExist = fs.existsSync(screenshotPath)
      if (!isScreenshotExist) await this.page.screenshot({ path: screenshotPath })
    }

    return { fbid, isPhotoFetched }
  }

  getFbid() {
    return new URL(this.page.url()).searchParams.get('fbid')
  }

  async fetchPhotoInfo() {
    const { src, complementary } = await this.page.evaluate((s) => {
      const img = document.querySelector(s.photoImg) as HTMLImageElement
      const complementary = document.querySelector(s.complementary) as HTMLElement

      return {
        src: img?.src,
        complementary: complementary?.innerText,
      }
    }, this.selectors)

    const imgUrl = src && src.includes('?') ? src.split('?')[0] : ''

    return {
      imgUrl,
      complementary,
    }
  }

  async navigateToPage(url = this.targetUrl) {
    await Promise.all([this.page.goto(url), this.page.waitForNavigation({ waitUntil: 'networkidle0' })])
  }

  async clickReadMore() {
    await this.page.evaluate((s) => {
      const readMoreBtn = document.querySelector(s.readMore) as HTMLElement
      const isReadMoreBtn = readMoreBtn && !readMoreBtn.innerHTML.includes('img')
      if (isReadMoreBtn) readMoreBtn.click()
    }, this.selectors)
  }
}
