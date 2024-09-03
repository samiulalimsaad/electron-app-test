import axios from 'axios'
import cors from 'cors'
import { app } from 'electron'
import express from 'express'

import fs from 'fs'
import path from 'path'
import { mainWindow } from '../main'

export const expressApp = express()

expressApp.use(cors())

let v = 0

expressApp.get('/', (req, res) => {
  res.send('Hello from Express inside Electron! ' + v++)
})

expressApp.use(cors())

// API to download the video and store it in the 'public/videos' folder
expressApp.get('/download', async (req, res) => {
  const videoUrl = req.query.url // Get video URL from query parameters
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream'
    })

    const videoName = `video-${Date.now()}.mp4` // Generate a unique video name
    const downloadPath = path.join(app.getAppPath(), 'videos', videoName)

    const fileStream = fs.createWriteStream(downloadPath)
    const totalLength = parseInt(response.headers['content-length'], 10)
    let downloadedLength = 0

    // Track progress as data is downloaded
    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length
      const progressPercentage = ((downloadedLength / totalLength) * 100).toFixed(2)
      console.log(`Downloaded: ${progressPercentage}%`)
      mainWindow.webContents.send('download-progress', progressPercentage)
    })

    // Save the file to the 'public/videos' folder
    response.data.pipe(fileStream)

    // When the download is complete, send back the video URL
    fileStream.on('finish', () => {
      res.json({ message: 'Download complete', url: `/videos/${videoName}` })
    })

    // Handle errors during the download
    fileStream.on('error', (err) => {
      console.error(err)
      res.status(500).json({ error: 'Failed to download video' })
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to download video' })
  }
})

// Route to stream video
expressApp.get('/videos/:filename', (req, res) => {
  console.log('object................')
  //   const videoPath = path.join(__dirname, 'videos', req.params.filename)
  const videoPath = path.join(app.getAppPath(), 'videos', req.params.filename)

  console.log({ videoPath })
  const stat = fs.statSync(videoPath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = end - start + 1
    const file = fs.createReadStream(videoPath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    }
    res.writeHead(200, head)
    fs.createReadStream(videoPath).pipe(res)
  }
})

// Start Express server
export const startExpressServer = (): unknown =>
  expressApp.listen(3000, () => {
    console.log('Express server running on http://localhost:3000')
  })

export const stopExpressServer = (): unknown => expressApp.close()
