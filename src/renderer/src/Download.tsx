// renderer.tsx
import React, { useEffect, useState } from 'react'

const id = '123456789'

const Download: React.FC = () => {
  const [progress, setProgress] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const [link, setLink] = useState(
    'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_30mb.mp4'
  )

  useEffect(() => {
    window.electron.ipcRenderer.invoke(`request-download`, id)
    // Listen for download progress updates
    window.electron.ipcRenderer.on(`download-progress-${id}`, (_, p: number) => {
      //   console.log(p)
      setProgress(p)
    })

    window.electron.ipcRenderer.on(`download-complete-${id}`, () => {
      setProgress(100)
      alert('Download Complete')
    })

    window.electron.ipcRenderer.on(`download-cancelled-${id}`, () => {
      alert('Download Cancelled')
    })

    window.electron.ipcRenderer.on(`download-error-${id}`, (_, error: string) => {
      alert(`Download Error: ${error}`)
    })

    // Cleanup listeners on unmount
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners(`download-progress-${id}`)
      window.electron.ipcRenderer.removeAllListeners(`download-complete-${id}`)
      window.electron.ipcRenderer.removeAllListeners(`download-cancelled-${id}`)
      window.electron.ipcRenderer.removeAllListeners(`download-error-${id}`)
    }
  }, [])

  const startDownload = (): void => {
    window.electron.ipcRenderer.invoke(`start-download-${id}`, link)
  }

  const pauseDownload = (): void => {
    window.electron.ipcRenderer.invoke(`pause-download-${id}`)
    setIsPaused(true)
  }

  const resumeDownload = (): void => {
    window.electron.ipcRenderer.invoke(`resume-download-${id}`)
    setIsPaused(false)
  }

  const cancelDownload = (): void => {
    window.electron.ipcRenderer.invoke(`cancel-download-${id}`)
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
