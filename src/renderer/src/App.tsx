import * as Sentry from '@sentry/electron/renderer'
import axios from 'axios'
import { FormEvent, useEffect, useState } from 'react'
import electronLogo from './assets/electron.svg'
import Versions from './components/Versions'
import Download from './Download'

const scope = Sentry.getCurrentScope()
scope.setTag('my-tag', 'my value')
scope.setUser({
  id: 42,
  email: 'john.doe@example.com'
})
function App(): JSX.Element {
  const [count, setCount] = useState(0)
  const ipcHandle = async (): Promise<void> => {
    const data = await window.electron.ipcRenderer.invoke('/ping', 'hello')
    console.log({ data })
    setCount(data)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    // fetch('https://hello.com')
    const err = event.currentTarget.error.value
    console.log(err)
    alert('error send: ' + err)
    throw new Error('error: ' + err)
  }

  const [state, setState] = useState('')

  useEffect(() => {
    axios.get('http://localhost:3000/').then(({ data }) => setState(data))
  }, [count])

  return <Download />
  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <button onClick={ipcHandle}>Send IPC</button>
        </div>
      </div>
      <div>Hello - {count} </div>
      <div>state - {state} </div>
      <form onSubmit={handleSubmit}>
        <input type="text" name="error" />
        <button type="submit">Send</button>
      </form>
      <Versions></Versions>
    </>
  )
}

export default App
