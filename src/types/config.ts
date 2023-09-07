'use strict'

import type { PhotoInfo } from './photo'

interface PuppeteerConfig {
  headless: boolean
  executablePath: string
}

export interface UserConfig {
  puppeteerConfig: PuppeteerConfig
  destination: string
  screenshotWeb: boolean
  retryLimit?: number
  fullLoad?: boolean
  workLogPath?: string
  mainRetryWaitSec?: number
  taskRetryWaitSec?: number
}

export interface FailLog {
  currentUrl: string
  photoData: Record<string, PhotoInfo>
}
