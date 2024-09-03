import axios from 'axios'
import React, { useEffect, useState } from 'react'

const VideoDownloader: React.FC = () => {
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)

  useEffect(() => {
    window.electron.ipcRenderer.on('download-progress', (_event, p: number) => {
      console.log({ p })
      setProgress(p)
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('download-progress')
    }
  }, [])

  const downloadVideo = async (): Promise<void> => {
    setIsDownloading(true)
    setProgress(0)
    setIsDownloaded(false)

    try {
      await axios.get('http://localhost:3000/download', {
        params: {
          url: 'https://videos.pexels.com/video-files/4114797/4114797-uhd_2560_1440_25fps.mp4'
        }
      })
    } catch (error) {
      console.error('Error downloading video', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div>
      <h1>Video Downloader</h1>
      <button onClick={downloadVideo}>Download Video</button>
      {isDownloading && <p>Downloading: {progress}%</p>}
      <progress value={progress} max="100" style={{ width: '100%' }} />
      {isDownloaded && <p>Download complete!</p>}
    </div>
  )
}

export default VideoDownloader
