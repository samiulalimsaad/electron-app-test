// main.ts
import axios from 'axios'
import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { clearInterval } from 'timers'

let isPaused = false
let isCancelled = false
let downloadedLength = 0
let totalLength = 0
let downloadUrl = ''
let writeStream: fs.WriteStream | null = null
import { loadDownloadState, saveDownloadState, clearDownloadState } from './db-sqlite/index'

const progressFile = path.join(app.getAppPath(), 'progress', 'downloadProgress.json')
interface DownloadState {
  downloadUrl: string
  downloadedLength: number
  totalLength: number
}
let tout: NodeJS.Timeout
let shouldSend = false

function startPauseResume(): void {
  if (tout) clearInterval(tout)
  tout = setInterval(() => {
    shouldSend = true
  }, 1000)
}

// function saveProgress(): void {
//   const progressData = {
//     downloadedLength,
//     downloadUrl,
//     totalLength
//   }
//   fs.writeFileSync(progressFile, JSON.stringify(progressData))
// }

// Helper to load progress from a file
function loadProgress(): void {
  const {
    downloadUrl: savedUrl,
    downloadedLength: savedLength,
    totalLength: savedTotal
  } = (loadDownloadState(downloadUrl) as DownloadState) || {}
  // if (!fs.existsSync(progressFile)) {
  //   fs.writeFileSync(
  //     progressFile,
  //     JSON.stringify({
  //       downloadedLength: 0,
  //       downloadUrl: '',
  //       totalLength: 0
  //     })
  //   )
  // }
  // const progressData = fs.readFileSync(progressFile, 'utf8')
  // console.log({ progressData })
  // const {
  //   downloadedLength: savedLength,
  //   downloadUrl: savedUrl,
  //   totalLength: savedTotal
  // } = JSON.parse(progressData || '{}')
  downloadedLength = savedLength || 0
  downloadUrl = savedUrl
  totalLength = savedTotal || 0
  isPaused = true
  console.log({ isPaused, isCancelled, downloadedLength, totalLength, downloadUrl })
}

function previousProgress(): void {
  console.log({ downloadedLength, totalLength })
  const progressPercentage = ((downloadedLength / totalLength) * 100).toFixed(2)
  console.log({ progressPercentage })

  const mainWindow = BrowserWindow.getFocusedWindow()
  if (!mainWindow) return
  mainWindow?.webContents.send('download-progress', parseFloat(progressPercentage) || 0)
}

setTimeout(() => {
  loadProgress()
  previousProgress()
}, 1000)

// Handle download requests
ipcMain.handle('start-download', async (event, url: string) => {
  downloadUrl = url
  isPaused = false
  isCancelled = false
  //   downloadedLength = 0
  startPauseResume()
  startDownload(BrowserWindow.getFocusedWindow())
})

// Start download
async function startDownload(mainWindow: BrowserWindow | null): Promise<void> {
  console.log({ isPaused, isCancelled, downloadedLength, totalLength, downloadUrl })

  if (!mainWindow) return

  try {
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: { Range: `bytes=${downloadedLength}-` } // Support resuming from the paused point
    })

    totalLength = response.headers['content-length']
      ? parseInt(response.headers['content-length']) + downloadedLength
      : totalLength

    writeStream = fs.createWriteStream(
      path.join(app.getAppPath(), 'videos', 'downloadedFile.mp4'),
      {
        flags: 'a'
      }
    )

    response.data.on('data', (chunk) => {
      if (isPaused || isCancelled) {
        response.data.pause()
        return
      }

      downloadedLength += chunk.length
      const progressPercentage = ((downloadedLength / totalLength) * 100).toFixed(2)
      console.log({ progressPercentage })

      //   if (tout) clearInterval(tout)
      // Send progress to renderer
      if (shouldSend) {
        mainWindow.webContents.send('download-progress', parseFloat(progressPercentage))
        shouldSend = false
      }
      writeStream?.write(chunk)
    })

    response.data.on('end', () => {
      mainWindow.webContents.send('download-progress', parseFloat('100'))
      if (isCancelled) {
        writeStream?.close()
        // fs.unlinkSync(path.join(app.getAppPath(), 'videos', 'downloadedFile.mp4')) // Delete incomplete file if canceled

        clearDownloadState(downloadUrl)
        mainWindow.webContents.send('download-cancelled')
        saveDownloadState(downloadUrl, downloadedLength, totalLength)
      } else if (!isPaused) {
        writeStream?.close()
        mainWindow.webContents.send('download-complete')
        saveDownloadState(downloadUrl, downloadedLength, totalLength)
      }
    })
  } catch (error) {
    console.error('Download failed:', error)
    mainWindow?.webContents.send('download-error', error.message)
    saveDownloadState(downloadUrl, downloadedLength, totalLength)
  }
}

// Handle pause
ipcMain.handle('pause-download', () => {
  isPaused = true
  saveDownloadState(downloadUrl, downloadedLength, totalLength)
  clearInterval(tout)
})

// Handle resume
ipcMain.handle('resume-download', () => {
  isPaused = false
  startPauseResume()
  startDownload(BrowserWindow.getFocusedWindow())
})

// Handle cancel
ipcMain.handle('cancel-download', () => {
  isCancelled = true
  isPaused = false
  saveDownloadState(downloadUrl, downloadedLength, totalLength)
  clearInterval(tout)
})
