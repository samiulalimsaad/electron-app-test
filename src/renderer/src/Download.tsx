// renderer.tsx
import { assert } from 'console'
import React, { useEffect, useState } from 'react'

const Download: React.FC = () => {
  const [progress, setProgress] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const [link, setLink] = useState(
    'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_30mb.mp4'
  )

  useEffect(() => {
    // Listen for download progress updates
    window.electron.ipcRenderer.on('download-progress', (_, p: number) => {
      //   console.log(p)
      setProgress(p)
    })

    window.electron.ipcRenderer.on('download-complete', () => {
      setProgress(100)
      alert('Download Complete')
    })

    window.electron.ipcRenderer.on('download-cancelled', () => {
      alert('Download Cancelled')
    })

    window.electron.ipcRenderer.on('download-error', (_, error: string) => {
      alert(`Download Error: ${error}`)
    })

    // Cleanup listeners on unmount
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('download-progress')
      window.electron.ipcRenderer.removeAllListeners('download-complete')
      window.electron.ipcRenderer.removeAllListeners('download-cancelled')
      window.electron.ipcRenderer.removeAllListeners('download-error')
    }
  }, [])

  const handleDefaultDownloadLocation = async (): Promise<void> => {
    const path = await window.electron.ipcRenderer.invoke('set-default-download-path')
    if (path) {
      alert('Default download path set to  ' + path)
    }
  }
  const startDownload = (): void => {
    window.electron.ipcRenderer.invoke('start-download', link)
  }

  const pauseDownload = (): void => {
    window.electron.ipcRenderer.invoke('pause-download')
    setIsPaused(true)
  }

  const resumeDownload = (): void => {
    window.electron.ipcRenderer.invoke('resume-download')
    setIsPaused(false)
  }

  const cancelDownload = (): void => {
    window.electron.ipcRenderer.invoke('cancel-download')
  }
  console.log({ progress })
  return (
    <div>
      <div>
        <input
          type="text"
          placeholder="video link"
          style={{ width: '100%', height: '30px' }}
          onBlur={(e) => setLink(e.target.value)}
          disabled={progress > 0 && !isPaused}
        />
      </div>
      <h1>Download Progress:</h1>
      <p>{progress}%</p>
      <progress value={progress} max="100" style={{ width: '100%' }} />

      <div>
        <button onClick={handleDefaultDownloadLocation}>Set Download Location</button>
        <button onClick={startDownload} disabled={progress > 0 && !isPaused}>
          Start Download
        </button>
        <button onClick={pauseDownload} disabled={isPaused || progress === 0}>
          Pause Download
        </button>
        <button onClick={resumeDownload} disabled={!isPaused}>
          Resume Download
        </button>
        <button onClick={cancelDownload} disabled={progress === 0}>
          Cancel Download
        </button>
      </div>
    </div>
  )
}

export default Download
