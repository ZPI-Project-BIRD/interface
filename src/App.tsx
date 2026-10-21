import './App.css'
import { ConfigProvider } from 'antd'
import { theme } from './theme'
import RegisterForm from './components/RegisterForm'
import Navbar from './components/Navbar'

function App() {

  return (
    <ConfigProvider theme={theme}>
      <Navbar />
      <RegisterForm />
    </ConfigProvider>
  )
}

export default App
