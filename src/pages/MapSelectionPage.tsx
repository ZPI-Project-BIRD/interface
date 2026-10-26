import { Layout, Card, Row, Col } from "antd"
import { Footer, Content, Header } from "antd/es/layout/layout"

const MapSelectionPage = () => {
  return (
    <Layout>
      <Header>

      </Header>
      <Content>
        <Row>
          <Col>
            <Card className="bg-amber-300">
              <p>Map Selection Page</p>
            </Card>
          </Col>
          <Col>
            <Card className="bg-amber-900">
              <p>Map Selection Page</p>
            </Card>
          </Col>
        </Row>
      </Content>
      <Footer>
        footer
      </Footer>
    </Layout>
  )
}

export default MapSelectionPage