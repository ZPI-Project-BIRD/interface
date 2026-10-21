import { useState } from 'react'
import './App.css'
import { ConfigProvider } from 'antd'
import { theme } from './theme'
import RegisterForm from './components/RegisterForm'

function App() {
  const [count, setCount] = useState(0)

  return (
    <ConfigProvider theme={theme}>
      <RegisterForm />
    </ConfigProvider>
  )
}

export default App
