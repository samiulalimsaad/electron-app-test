import axios from 'axios'
import { useState } from 'react'
import VideoDownloader from './VideoDownloader'

const Video = (): JSX.Element => {
  const [videoFile, setVideoFile] = useState(null)
  // const [videoUrl, setVideoUrl] = useState("/1725167341324-Holud promo.mp4");
  const [videoUrl, setVideoUrl] = useState('http://localhost:3000/videos/sample.mp4')

  const handleVideoUpload = async (e) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('video', videoFile)

    try {
      const res = await axios.post('http://localhost:3000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setVideoUrl(`http://localhost:3000${res.data.filePath}`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="App">
      <h1>Video Streaming MERN App</h1>
      <VideoDownloader />

      {videoUrl && (
        <div>
          <h2>Uploaded Video</h2>
          <video width="600" controls src={videoUrl} />
        </div>
      )}
    </div>
  )
}

export default Video
