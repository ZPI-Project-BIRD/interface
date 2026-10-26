import { Space, Typography } from 'antd';
import image from '../assets/logo.png';

const Title = () => {
  return (
    <Space size="medium">
      {/* placeholder icon */}
      <img src={image} alt="Logo" className="w-16 h-16" />
      <Typography.Title level={3}>
        Building Irregularity Recognition and Detection
      </Typography.Title>
    </Space>
  )
}

export default Title