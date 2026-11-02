import { QueryClientProvider } from "react-query";
import { BrowserRouter } from "react-router";
import App from "./App";
import { useAuthStore } from "./stores/authStore";

export default function SessionApp() {
  const queryClient = useAuthStore((state) => state.queryClient);
  const sessionId = useAuthStore((state) => state.sessionId);

  return (
    <QueryClientProvider key={sessionId} client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
