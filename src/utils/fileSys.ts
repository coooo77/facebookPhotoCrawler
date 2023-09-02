'use strict'

import fs from 'fs'
import path from 'path'

export default {
  cookiePath: path.join('cookie', 'cookie.json'),

  dataSavePath: path.join('data'),

  getDataSavePath() {
    if (!fs.existsSync(this.dataSavePath)) this.makeDirIfNotExist(this.dataSavePath)

    return this.dataSavePath
  },

  getJSONFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null

    const result = fs.readFileSync(filePath, 'utf8')

    return JSON.parse(result)
  },

  makeDirIfNotExist(fileLocation: string) {
    if (fs.existsSync(fileLocation)) return

    fs.mkdirSync(fileLocation, { recursive: true })
  },

  saveJSONFile(filePath: string, data: any) {
    const { dir } = path.parse(filePath)

    this.makeDirIfNotExist(dir)

    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8')
  },
}
