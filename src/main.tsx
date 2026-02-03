import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import { SessionProvider } from "./context/SessionContext";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <SessionProvider>
      <App />
    </SessionProvider>
  </ThemeProvider>
);
