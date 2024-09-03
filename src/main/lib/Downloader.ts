import axios from 'axios'
import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { clearInterval } from 'timers'

export class Downloader {
  private isPaused = false
  private isCancelled = false
  private downloadedLength = 0
  private totalLength = 0
  private downloadUrl = ''
  private writeStream: fs.WriteStream | null = null
  private progressFile = path.join(app.getAppPath(), 'progress', 'downloadProgress.json')

  private tout: NodeJS.Timeout | undefined = undefined
  private shouldSend = false

  constructor() {
    console.log('constructor')
    this.startDownloadListener()
    this.resumeDownloadListener()
    this.cancelDownloadListener()
    // this.loadProgress()
    setTimeout(() => {
      this.loadProgress()
      this.previousProgress()
    }, 1000)
  }

  private startPauseResume(): void {
    if (this.tout) clearInterval(this.tout)
    this.tout = setInterval(() => {
      this.shouldSend = true
    }, 1000)
  }

  private saveProgress(): void {
    const progressData = {
      downloadedLength: this.downloadedLength,
      downloadUrl: this.downloadUrl,
      totalLength: this.totalLength
    }
    fs.writeFileSync(this.progressFile, JSON.stringify(progressData))
  }

  private loadProgress(): void {
    if (!fs.existsSync(this.progressFile)) {
      fs.writeFileSync(
        this.progressFile,
        JSON.stringify({
          downloadedLength: 0,
          downloadUrl: '',
          totalLength: 0
        })
      )
    }
    const progressData = fs.readFileSync(this.progressFile, 'utf8')
    console.log({ progressData })
    const {
      downloadedLength: savedLength,
      downloadUrl: savedUrl,
      totalLength: savedTotal
    } = JSON.parse(progressData || '{}')
    this.downloadedLength = savedLength || 0
    this.downloadUrl = savedUrl
    this.totalLength = savedTotal || 0
    this.isPaused = true

    console.log({
      isPaused: this.isPaused,
      isCancelled: this.isCancelled,
      downloadedLength: this.downloadedLength,
      totalLength: this.totalLength,
      downloadUrl: this.downloadUrl
    })
  }

  private previousProgress(): void {
    console.log({
      downloadedLength: this.downloadedLength,
      totalLength: this.totalLength
    })
    const progressPercentage = ((this.downloadedLength / this.totalLength) * 100).toFixed(2)
    console.log({ progressPercentage })

    const mainWindow = BrowserWindow.getFocusedWindow()
    if (!mainWindow) return
    mainWindow?.webContents.send('download-progress', parseFloat(progressPercentage) || 0)
  }

  private async startDownload(): Promise<void> {
    const mainWindow = BrowserWindow.getFocusedWindow()
    console.log({
      isPaused: this.isPaused,
      isCancelled: this.isCancelled,
      downloadedLength: this.downloadedLength,
      totalLength: this.totalLength,
      downloadUrl: this.downloadUrl,
      shouldSend: this.shouldSend,
      mainWindow: mainWindow
    })

    if (!mainWindow) return

    try {
      const response = await axios({
        url: this.downloadUrl,
        method: 'GET',
        responseType: 'stream',
        headers: { Range: `bytes=${this.downloadedLength}-` } // Support resuming from the paused point
      })

      this.totalLength = response.headers['content-length']
        ? parseInt(response.headers['content-length']) + this.downloadedLength
        : this.totalLength

      this.writeStream = fs.createWriteStream(
        path.join(app.getAppPath(), 'videos', 'downloadedFile.mp4'),
        {
          flags: 'a'
        }
      )

      response.data.on('data', (chunk) => {
        if (this.isPaused || this.isCancelled) {
          response.data.pause()
          return
        }

        this.downloadedLength += chunk.length
        const progressPercentage = ((this.downloadedLength / this.totalLength) * 100).toFixed(2)
        console.log({ progressPercentage })
        this.saveProgress()

        //   if (tout) clearInterval(tout)
        // Send progress to renderer
        if (this.shouldSend) {
          mainWindow?.webContents.send('download-progress', parseFloat(progressPercentage))
          this.shouldSend = false
        }
        this.writeStream?.write(chunk)
      })

      response.data.on('end', () => {
        mainWindow?.webContents.send('download-progress', parseFloat('100'))
        if (this.isCancelled) {
          this.writeStream?.close()
          fs.unlinkSync(path.join(app.getAppPath(), 'videos', 'downloadedFile.mp4')) // Delete incomplete file if canceled
          mainWindow?.webContents.send('download-cancelled')
          this.saveProgress()
        } else if (!this.isPaused) {
          this.writeStream?.close()
          mainWindow?.webContents.send('download-complete')
          this.saveProgress()
        }
      })
    } catch (error) {
      console.error('Download failed:', error)
      mainWindow?.webContents.send('download-error', error.message)
      this.saveProgress()
    }
  }

  startDownloadListener(): void {
    console.log('start download listener')
    ipcMain.handle('start-download', async (event, url: string) => {
      console.log('listener activated: ', { url })
      this.downloadUrl = url
      this.isPaused = false
      this.isCancelled = false
      //   downloadedLength = 0
      this.startPauseResume()
      this.startDownload()
    })
  }

  pauseDownloadListener(): void {
    ipcMain.handle('pause-download', () => {
      this.isPaused = true
      this.saveProgress()
      clearInterval(this.tout)
    })
  }

  resumeDownloadListener(): void {
    ipcMain.handle('resume-download', () => {
      this.isPaused = false
      this.startPauseResume()
      this.startDownload()
    })
  }

  cancelDownloadListener(): void {
    ipcMain.handle('cancel-download', () => {
      this.isCancelled = true
      this.isPaused = false
      this.saveProgress()
      clearInterval(this.tout)
    })
  }
}
