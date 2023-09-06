'use strict'

export interface PhotoInfo {
  url: string
  imgUrl: string
  complementary: string
}

export interface ParentPhotoData {
  currentUrl: string
  photoData: Record<string, PhotoInfo>
}
