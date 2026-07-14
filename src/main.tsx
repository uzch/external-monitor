import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { AccountDetailPage } from "./ui/AccountDetailPage";
import { PortfolioPage } from "./ui/PortfolioPage";
import { AutonomousResearchPage } from "./ui/AutonomousResearchPage";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <PortfolioPage />,
      },
      {
        path: "research",
        element: <AutonomousResearchPage />,
      },
      {
        path: "accounts/:accountId",
        element: <AccountDetailPage />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
