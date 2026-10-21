import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import LoginForm from './components/LoginForm'
import { ConfigProvider } from 'antd'
import { theme } from './theme'

function App() {
  const [count, setCount] = useState(0)

  return (
    <ConfigProvider theme={theme}>
      <LoginForm />
    </ConfigProvider>
  )
}

export default App
