import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import "./FilesApp.css";
import { AppProvider } from "./AppContext";
import Home from "./components/Home";
import PrDetails from "./components/PrDetails";

function App() {
    return (
        <main className="container">
            <AppProvider>
                <Router>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/pr/:prNumber" element={<PrDetails />} />
                    </Routes>
                </Router>
            </AppProvider>
        </main>
    );
}

export default App;
