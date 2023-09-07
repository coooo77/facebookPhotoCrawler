'use strict'

import fs from 'fs'
import path from 'path'

import helper from './helper'

import type { PhotoInfo } from '../types/photo'
import type  { FailLog } from '../types/config'

export default {
  cookiePath: path.join(__dirname, '..', '..', 'cookie', 'cookie.json'),

  dataSavePath: path.join(__dirname, '..', '..', 'data'),

  failLogPath: path.join(__dirname, '..', '..', 'fail'),

  getOrCreateDirPath(type: 'data' | 'fail') {
    const targetPath = type === 'data' ? this.dataSavePath : this.failLogPath

    if (!fs.existsSync(targetPath)) this.makeDirIfNotExist(targetPath)

    return targetPath
  },

  getJSONFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null

    const result = fs.readFileSync(filePath, 'utf8')

    return JSON.parse(result)
  },

  makeDirIfNotExist(fileLocation: string) {
    if (!fileLocation) throw new Error(`invalid dir path: ${fileLocation};`)

    if (fs.existsSync(fileLocation)) return

    fs.mkdirSync(fileLocation, { recursive: true })
  },

  saveJSONFile(filePath: string, data: any) {
    const { dir } = path.parse(filePath)

    this.makeDirIfNotExist(dir)

    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8')
  },

  saveFailLog(currentUrl: string, photoData: Map<string, PhotoInfo>) {
    const photoFetched = Array.from(photoData).at(-1)
    if (photoFetched?.[1]?.imgUrl) currentUrl = photoFetched?.[1].url

    const failLog: FailLog = {
      currentUrl,
      photoData: Object.fromEntries(photoData.entries()),
    }

    const failLogDir = this.getOrCreateDirPath('fail')
    const failFilename = `${helper.getTimeString()}_fail.json`
    const failLogPath = path.join(failLogDir, failFilename)
    this.saveJSONFile(failLogPath, failLog)
  },
}
