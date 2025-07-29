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
    <div className="w-[400px] items-center justify-center overflow-hidden">
      {/* Content area - đây là nội dung thực sự của extension */}
      {renderPage()}
      <Toaster />
    </div>
  );
}

export default App;
