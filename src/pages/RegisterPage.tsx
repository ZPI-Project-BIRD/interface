import { useNavigate } from "react-router";
import RegisterForm from "../components/RegisterForm";
import { Flex } from "antd";

function RegisterPage() {
  const navigate = useNavigate();

  return (
    <Flex justify="center" align="center" className="min-h-dvh">
      <RegisterForm onLoginClick={() => navigate("/login")} />
    </Flex>
  );
}

export default RegisterPage;
