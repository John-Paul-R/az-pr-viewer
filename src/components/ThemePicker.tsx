import { useEffect, useState } from "react";
import "./ThemePicker.css";

interface ThemePickerProps {
    defaultTheme?: string;
}

const ThemePicker: React.FC<ThemePickerProps> = ({
    defaultTheme = "light",
}) => {
    const [currentTheme, setCurrentTheme] = useState<string>(
        localStorage.getItem("theme") || defaultTheme,
    );

    useEffect(() => {
        // Apply theme on component mount and when it changes
        applyTheme(currentTheme);
    }, [currentTheme]);

    const applyTheme = (theme: string) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    };

    const handleThemeChange = (theme: string) => {
        setCurrentTheme(theme);
    };

    return (
        <div className="theme-picker">
            <span className="theme-picker-label">Theme:</span>
            <div className="theme-options">
                <button
                    className={`theme-button ${
                        currentTheme === "light" ? "active" : ""
                    }`}
                    onClick={() => handleThemeChange("light")}
                    title="Light Theme"
                >
                    <span className="theme-icon light-icon"></span>
                </button>
                <button
                    className={`theme-button ${
                        currentTheme === "dark" ? "active" : ""
                    }`}
                    onClick={() => handleThemeChange("dark")}
                    title="Dark Theme"
                >
                    <span className="theme-icon dark-icon"></span>
                </button>
                <button
                    className={`theme-button ${
                        currentTheme === "azure" ? "active" : ""
                    }`}
                    onClick={() => handleThemeChange("azure")}
                    title="Azure Theme"
                >
                    <span className="theme-icon azure-icon"></span>
                </button>
                <button
                    className={`theme-button ${
                        currentTheme === "catppuccin-pink" ? "active" : ""
                    }`}
                    onClick={() => handleThemeChange("catppuccin-pink")}
                    title="Catppuccin Pink Theme"
                >
                    <span className="theme-icon catppuccin-pink-icon"></span>
                </button>
                <button
                    className={`theme-button ${
                        currentTheme === "catppuccin-pink-dark" ? "active" : ""
                    }`}
                    onClick={() => handleThemeChange("catppuccin-pink-dark")}
                    title="Catppuccin Pink Dark Theme"
                >
                    <span className="theme-icon catppuccin-pink-dark-icon"></span>
                </button>
            </div>
        </div>
    );
};

export default ThemePicker;
