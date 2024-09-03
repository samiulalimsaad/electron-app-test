const getUniquePath = (path: string | null): string | null => {
  if (!path) {
    return null
  }
  const downloadPath = path.split('\\')
  const filePath = downloadPath.slice(0, -1).join('\\')
  const uniquePath = filePath + `\\${Date.now()}.mp4`
  return uniquePath
}

export default getUniquePath
