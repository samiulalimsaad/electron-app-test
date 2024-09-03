import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import * as Sentry from '@sentry/electron/main'
import downstreamElectron from 'downstream-electron'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { startExpressServer } from '../express/server'
// import './download'

import { Downloader } from './lib/Downloader'

ipcMain.handle(`request-download`, async (_, id: string) => {
  console.log('listener activating: ', { id })
  const { init } = new Downloader()
  init(id)
})

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  debug: true
})

export let mainWindow: BrowserWindow

// Sentry.addBreadcrumb({
//   category: 'auth',
//   message: 'User clicked login',
//   level: 'info'
// })

// Capture error with breadcrumbs attached
// Sentry.captureException(new Error('Login failed'))

// Sentry.setUser({
//   id: '12345',
//   email: 'user@example.com',
//   username: 'user123'
// })

// Add other global context like tags or extra data
Sentry.setTag('app_version', '1.0.0')
Sentry.setExtra('user_role', 'admin')

const userSettings = {
  appDir: '/Users/admin/myApp',
  settingsName: 'settings',
  publicName: 'public',
  downloadsName: 'movies'
}

let downstreamInstance

function createWindow(): void {
  downstreamInstance = downstreamElectron.init(userSettings)
  if (mainWindow) {
    // If window already exists, focus it and return
    mainWindow.focus()
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  startExpressServer()
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  let i = 0
  // IPC test
  ipcMain.handle('/ping', () => {
    console.log('pong -> ', i)
    return i++
    // dialog.showErrorBox('Error Message', 'Test Message')
  })

  const pathname = app.getAppPath()
  console.log({ pathname })
  app.setPath('userData', pathname + '/logs/my-app')

  createWindow()

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    } else {
      mainWindow.focus()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    // stopExpressServer()
  }
})

function onWillQuit(): void {
  downstreamInstance.stop()
  //   stopExpressServer()
}

app.on('will-quit', onWillQuit)

/** Check if single instance, if not, simply quit new instance */
const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
  app.quit()
}

// Behaviour on second instance for parent process- Pretty much optional
app.on('second-instance', (event, argv, cwd) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
