import { Button, Flex, Result } from 'antd'
import { useNavigate } from 'react-router'

const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Flex vertical justify="center" align="center" className="min-h-dvh">
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the page does not exist."
        extra={
          <Button type="primary" onClick={() => navigate("/login")}>
            Go to login
          </Button>
        }
      />
    </Flex>
  )
}

export default NotFoundPage;