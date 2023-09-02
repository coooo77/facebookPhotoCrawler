### step 1 - fetch to local

follow steps in your terminal

```
git clone https://github.com/coooo77/facebookPhotoCrawler.git

cd facebookPhotoCrawler

npm install
```

### step 2 - create config.json file in src folder

- executablePath - path of chrome.exe
- headless - set it false to show crawler brower
- screenshotWeb - take screenshot from website
- destination: url from facebook, e.g. https://www.facebook.com/photo.php?fbid=XXX

```
// src\config.json
{
  "puppeteerConfig": {
    "headless": false,
    "executablePath": "path/to/chrome.exe"
  },
  "destination": "url to facebook photo gallery",
  "screenshotWeb": true
}
```

### step 3 - execute program

```
npm start
```
