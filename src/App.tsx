import { useState } from 'react'
import './App.css'
import { ConfigProvider } from 'antd'
import { theme } from './theme'
import RegisterForm from './components/RegisterForm'

function App() {

  return (
    <ConfigProvider theme={theme}>
      <RegisterForm />
    </ConfigProvider>
  )
}

export default App
