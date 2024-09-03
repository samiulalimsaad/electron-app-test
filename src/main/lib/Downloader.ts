import axios from 'axios'
import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

export class Downloader {
  private basePath = app.getAppPath()
  private postfix = ''

  private isPaused = false
  private isCancelled = false
  private downloadedLength = 0
  private totalLength = 0
  private downloadUrl = ''
  private writeStream: fs.WriteStream | null = null
  private progressDir = path.join(this.basePath, 'progress')
  private progressFile = ''

  private videoDir = path.join(this.basePath, 'videos')
  private videoFile = ''

  private tout: NodeJS.Timeout | undefined = undefined
  private shouldSend = false

  constructor() {
    this.mkDir(this.videoDir)
    this.mkDir(this.progressDir)
  }

  init(id = ''): void {
    this.postfix = id
    console.log('constructor')
    this.startDownloadListener()
    this.resumeDownloadListener()
    this.pauseDownloadListener()
    this.cancelDownloadListener()
    this.progressFile = path.join(this.progressDir, `${this.postfix}.json`)

    this.mkFile(this.progressFile)
    setTimeout(() => {
      this.loadProgress()
      this.previousProgress()
    }, 1000)
  }

  private flush(): void {
    console.log('removing listerers')
    this.writeStream?.close()
    ipcMain.removeAllListeners(`start-download-${this.postfix}`)
    ipcMain.removeAllListeners(`download-progress-${this.postfix}`)
    ipcMain.removeAllListeners(`download-cancel-${this.postfix}`)
    ipcMain.removeAllListeners(`download-pause-${this.postfix}`)
    ipcMain.removeAllListeners(`download-resume-${this.postfix}`)
    clearInterval(this.tout)
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
    mainWindow?.webContents.send(
      `download-progress-${this.postfix}`,
      parseFloat(progressPercentage) || 0
    )
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

      this.videoFile = path.join(this.videoDir, `${this.postfix}.mp4`)
      this.writeStream = fs.createWriteStream(this.videoFile, {
        flags: 'a'
      })

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
          mainWindow?.webContents.send(
            `download-progress-${this.postfix}`,
            parseFloat(progressPercentage)
          )
          this.shouldSend = false
        }
        this.writeStream?.write(chunk)
      })

      response.data.on('end', () => {
        mainWindow?.webContents.send(`download-progress-${this.postfix}`, parseFloat('100'))
        if (this.isCancelled) {
          this.writeStream?.close()
          fs.unlinkSync(path.join(app.getAppPath(), 'videos', 'downloadedFile.mp4')) // Delete incomplete file if canceled
          mainWindow?.webContents.send(`download-cancelled-${this.postfix}`)
          this.saveProgress()
          this.flush()
        } else if (!this.isPaused) {
          this.writeStream?.close()
          mainWindow?.webContents.send(`download-complete-${this.postfix}`)
          this.saveProgress()
        }
      })
    } catch (error) {
      console.error('Download failed:', error)
      mainWindow?.webContents.send(`download-error-${this.postfix}`, error.message)
      this.saveProgress()
      this.flush()
    }
  }

  startDownloadListener(): void {
    console.log('start download listener')
    ipcMain.handle(`start-download-${this.postfix}`, async (event, url: string) => {
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
    ipcMain.handle(`pause-download-${this.postfix}`, () => {
      this.isPaused = true
      this.saveProgress()
      clearInterval(this.tout)
    })
  }

  resumeDownloadListener(): void {
    ipcMain.handle(`resume-download-${this.postfix}`, () => {
      this.isPaused = false
      this.startPauseResume()
      this.startDownload()
    })
  }

  cancelDownloadListener(): void {
    ipcMain.handle(`cancel-download-${this.postfix}`, () => {
      const mainWindow = BrowserWindow.getFocusedWindow()
      this.isCancelled = true
      this.isPaused = false
      this.downloadedLength = 0
      this.totalLength = 0
      mainWindow?.webContents.send(`download-progress-${this.postfix}`, parseFloat('0'))
      this.saveProgress()
      this.flush()
      this.rmFile(this.progressFile)
      this.rmFile(this.videoFile)
    })
  }

  private mkDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath)
      console.log('Directory created!')
    } else {
      console.log('Directory already exists.')
    }
  }

  private mkFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '')
      console.log('File created!')
    } else {
      console.log('File already exists.')
    }
  }

  private rmFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath) // Remove the file
      console.log('File removed!')
    } else {
      console.log('File does not exist.')
    }
  }
}
