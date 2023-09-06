'use strict'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import config from './config.json'
import helper from './utils/helper'
import fileSys from './utils/fileSys'

puppeteer.use(StealthPlugin())

async function login() {
  const browser = await puppeteer.launch(config.puppeteerConfig)
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  await Promise.all([page.goto('https://www.facebook.com/'), page.waitForNavigation()])

  await helper.customPrompt('Enter after you login, cookie will be saved.')()

  const cookie = await page.cookies()
  fileSys.saveJSONFile(fileSys.cookiePath, cookie)
  console.log('cookie saved')

  await browser.close()
}

login()
