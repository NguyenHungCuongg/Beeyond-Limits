import { useState } from "react";
import Home from "./pages/Home";
import Pomodoro from "./pages/Pomodoro";
import TaskList from "./pages/TaskList";
import WebsiteBlocker from "./pages/WebsiteBlocker";
import AmbientSounds from "./pages/AmbientSounds";
import { Toaster } from "react-hot-toast";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home onNavigate={navigateTo} />;
      case "pomodoro":
        return <Pomodoro onNavigate={navigateTo} />;
      case "tasklist":
        return <TaskList onNavigate={navigateTo} />;
      case "websiteblocker":
        return <WebsiteBlocker onNavigate={navigateTo} />;
      case "ambientsounds":
        return <AmbientSounds onNavigate={navigateTo} />;
      default:
        return <Home onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="w-[400px] min-h-[600px] bg-canvas overflow-hidden">
      {/* Content area */}
      {renderPage()}
      <Toaster
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#000000",
            border: "3px solid #000000",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.875rem",
            boxShadow: "4px 4px 0px 0px #000000",
            borderRadius: "0",
          },
          success: {
            iconTheme: { primary: "#000000", secondary: "#ffffff" },
          },
          error: {
            iconTheme: { primary: "#000000", secondary: "#ffffff" },
          },
        }}
      />
    </div>
  );
}

export default App;
