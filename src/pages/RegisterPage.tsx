import { useNavigate } from "react-router";
import RegisterForm from "../components/RegisterForm";

function RegisterPage() {
  const navigate = useNavigate();

  return <RegisterForm onLoginClick={() => navigate("/login")} />;
}

export default RegisterPage;
