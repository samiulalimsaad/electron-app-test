import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

// Database path inside the user's app directory

// vidoe download path
const dbForDownloadLocation = new Database(path.join(app.getPath('userData'), 'videos.db'))

// set download progress in this database
const dbForDownloadProgress = new Database(path.join(app.getPath('userData'), 'downloads.db'))

// update donwload state when finished
export const setDownCompleteState = (mainWindow: Electron.BrowserWindow): void => {
  mainWindow.webContents.on('did-finish-load', () => {
    const savedState = dbForDownloadProgress.prepare(`SELECT * FROM downloads`).all()
    if (savedState.length > 0) {
      mainWindow.webContents.send('resume-download-state', savedState)
    }
  })
}
// Create the downloads table if it doesn't exist
dbForDownloadProgress
  .prepare(
    `
  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    downloadUrl  TEXT NOT NULL,
    downloadedLength INTEGER NOT NULL,
    totalLength INTEGER NOT NULL
  )
`
  )
  .run()
// Create tables if not exists
dbForDownloadLocation
  .prepare(
    `
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT,
    downloadPath TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
  )
  .run()

// db.prepare(
//   `
//   CREATE TABLE IF NOT EXISTS settings (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     defaultDownloadPath TEXT
//   )
// `
// ).run()

// Save default download path
export function saveDefaultDownloadPath(downloadPath: string): void {
  const setting = dbForDownloadLocation.prepare('SELECT * FROM settings WHERE id = 1').get()

  if (setting) {
    dbForDownloadLocation
      .prepare(`UPDATE settings SET defaultDownloadPath = ? WHERE id = 1`)
      .run(downloadPath)
  } else {
    dbForDownloadLocation
      .prepare(`INSERT INTO settings (id, defaultDownloadPath) VALUES (1, ?)`)
      .run(downloadPath)
  }
}

// Get default download path
export function getDefaultDownloadPath(): string | null {
  const setting = dbForDownloadLocation
    .prepare('SELECT defaultDownloadPath FROM settings WHERE id = 1')
    .get()
  return setting ? (setting as { defaultDownloadPath: string }).defaultDownloadPath : null
}

export function saveDownloadState(
  downloadUrl: string,
  downloadedLength: number,
  totalLength: number
): void {
  const existingRecord = dbForDownloadProgress
    .prepare(`SELECT * FROM downloads WHERE downloadUrl = ?`)
    .get(downloadUrl)

  if (existingRecord) {
    dbForDownloadProgress
      .prepare(`UPDATE downloads SET downloadedLength = ?, totalLength = ? WHERE downloadUrl = ?`)
      .run(downloadedLength, totalLength, downloadUrl)
  } else {
    dbForDownloadProgress
      .prepare(
        `INSERT INTO downloads (downloadUrl, downloadedLength, totalLength) VALUES (?, ?, ?)`
      )
      .run(downloadUrl, downloadedLength, totalLength)
  }
}
// Function to load the download progress from the database
export function loadDownloadState(downloadUrl: string): unknown {
  return dbForDownloadProgress
    .prepare(`SELECT * FROM downloads WHERE downloadUrl = ?`)
    .get(downloadUrl)
}

// Function to clear the download state from the database
export function clearDownloadState(downloadUrl: string): void {
  dbForDownloadProgress.prepare(`DELETE FROM downloads WHERE downloadUrl = ?`).run(downloadUrl)
}
// Save video metadata
// export function saveVideoMetadata(title: string, url: string): void {
//   const defaultPath = getDefaultDownloadPath()

//   if (!defaultPath) {
//     throw new Error('Default download path is not set!')
//   }

//   db.prepare('INSERT INTO videos (title, url, downloadPath) VALUES (?, ?, ?)').run(
//     title,
//     url,
//     defaultPath
//   )
// }
