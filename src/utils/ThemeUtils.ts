/**
 * Utility functions for theme detection and manipulation
 */

/**
 * Get the current theme name from the document
 * @returns The current theme name (e.g., "light", "dark", "azure", "catppuccin-pink", "catppuccin-pink-dark")
 */
export const getCurrentTheme = (): string => {
    return document.documentElement.getAttribute("data-theme") || "light";
};

/**
 * Check if the current theme is a dark theme
 * @returns true if the current theme is a dark theme, false otherwise
 */
export const isDarkTheme = (): boolean => {
    const theme = getCurrentTheme();
    // Add all dark theme names here
    return theme === "dark" || theme === "catppuccin-pink-dark";
};

/**
 * Check if the current theme is a Catppuccin theme
 * @returns true if the current theme is a Catppuccin theme, false otherwise
 */
export const isCatppuccinTheme = (): boolean => {
    const theme = getCurrentTheme();
    return theme.startsWith("catppuccin");
};

/**
 * Subscribe to theme changes
 * @param callback Function to call when the theme changes
 * @returns A function to unsubscribe from theme changes
 */
export const subscribeToThemeChanges = (
    callback: (theme: string) => void,
): (() => void) => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (
                mutation.type === "attributes" &&
                mutation.attributeName === "data-theme"
            ) {
                callback(getCurrentTheme());
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });

    // Return a function to unsubscribe
    return () => observer.disconnect();
};
