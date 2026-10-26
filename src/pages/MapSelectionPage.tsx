import { Layout, Card, Steps } from "antd"
import { Footer, Content, Header } from "antd/es/layout/layout"
import "../assets/map_placeholder.png"
import { useState } from "react";
import Title from "../components/Title";

const MapSelectionPage = () => {

  const [current, setCurrent] = useState(0);

  const onChange = (value: number) => {
    console.log('onChange:', value);
    setCurrent(value);
  };

  return (
    <Layout className="h-dvh">
      <Header>
        <Title />
      </Header>
      <Content className="p-[30px] flex flex-1">
        <Card className="flex-1">
          Map here
        </Card>
      </Content>
      <Footer>
        <Steps
        type="navigation"
        current={current}
        onChange={onChange}
        items={[
          {
            status: 'process',
            title: 'Step 1',
          },
          {
            status: 'wait',
            title: 'Step 2',
          },
          {
            status: 'wait',
            title: 'Step 3',
          },
          {
            status: 'wait',
            title: 'Step 4',
          },
        ]}
      />

      </Footer>
    </Layout>
  )
}

export default MapSelectionPage
