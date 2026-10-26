import { useNavigate } from "react-router";
import RegisterForm from "../components/RegisterForm";
import { Flex } from "antd";
import Title from "../components/Title";

function RegisterPage() {
  const navigate = useNavigate();

  return (
    <Flex vertical justify="center" align="center" className="min-h-dvh">
      <Title />
      <RegisterForm onLoginClick={() => navigate("/login")} />
    </Flex>
  );
}

export default RegisterPage;
