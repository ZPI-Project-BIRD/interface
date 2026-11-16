import { QueryClientProvider } from "react-query";
import { useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App";
import { useAuthStore } from "./stores/authStore";

const router = createBrowserRouter([{ path: "*", element: <App /> }]);

export default function SessionApp() {
  const queryClient = useAuthStore((state) => state.queryClient);
  const sessionId = useAuthStore((state) => state.sessionId);
  const hasDrafts = useAuthStore((state) => Object.keys(state.annotationDrafts).length > 0);
  useEffect(() => {
    if (!hasDrafts) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);

  return (
    <QueryClientProvider key={sessionId} client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
