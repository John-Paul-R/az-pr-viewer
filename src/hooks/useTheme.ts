import { useState, useEffect } from "react";
import {
    getCurrentTheme,
    isDarkTheme,
    isCatppuccinTheme,
    subscribeToThemeChanges,
} from "../utils/ThemeUtils";

/**
 * Custom hook for accessing and reacting to theme changes
 * @returns An object with theme information and a function to set the theme
 */
export function useTheme() {
    const [theme, setTheme] = useState(getCurrentTheme());
    const [dark, setDark] = useState(isDarkTheme());
    const [isCatppuccin, setIsCatppuccin] = useState(isCatppuccinTheme());

    useEffect(() => {
        // Update state when component mounts
        setTheme(getCurrentTheme());
        setDark(isDarkTheme());
        setIsCatppuccin(isCatppuccinTheme());

        // Subscribe to theme changes
        const unsubscribe = subscribeToThemeChanges((newTheme) => {
            setTheme(newTheme);
            setDark(isDarkTheme());
            setIsCatppuccin(isCatppuccinTheme());
        });

        // Cleanup subscription on unmount
        return unsubscribe;
    }, []);

    // Function to change theme
    const changeTheme = (newTheme: string) => {
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    };

    return {
        theme, // Current theme name
        isDark: dark, // Whether current theme is dark
        isCatppuccin, // Whether current theme is catppuccin
        changeTheme, // Function to change theme
    };
}

export default useTheme;
