import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import { DetachedPaneView } from "./components/DetachedPaneView";
import { DetachedProjectView } from "./components/DetachedProjectView";
import "./styles/globals.css";

function getWindowMode(): { mode: string; id: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("mode") || "main",
    id: params.get("id"),
  };
}

function Root() {
  const { mode, id } = getWindowMode();

  switch (mode) {
    case "pane":
      if (!id) {
        return <div className="p-4 text-destructive">Missing pane ID</div>;
      }
      return <DetachedPaneView paneId={id} />;
    case "project":
      if (!id) {
        return <div className="p-4 text-destructive">Missing project ID</div>;
      }
      return <DetachedProjectView projectId={id} />;
    default:
      return <App />;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <Root />
  </ThemeProvider>
);
