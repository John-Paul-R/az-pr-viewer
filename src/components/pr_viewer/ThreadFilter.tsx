import { useRef, KeyboardEvent } from "react";
import "./styles/ThreadFilter.css";

type FilterOption = "all" | "comments";

interface ThreadFilterProps {
    onFilterChange: (filter: FilterOption) => void;
    currentFilter: FilterOption;
}

export const ThreadFilter = ({
    onFilterChange,
    currentFilter,
}: ThreadFilterProps) => {
    const allButtonRef = useRef<HTMLButtonElement>(null);
    const commentsButtonRef = useRef<HTMLButtonElement>(null);

    const handleKeyDown = (
        e: KeyboardEvent<HTMLButtonElement>,
        _option: FilterOption,
    ) => {
        // Handle arrow keys for accessibility
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();

            if (e.key === "ArrowRight" && currentFilter === "all") {
                onFilterChange("comments");
                commentsButtonRef.current?.focus();
            } else if (e.key === "ArrowLeft" && currentFilter === "comments") {
                onFilterChange("all");
                allButtonRef.current?.focus();
            }
        }
    };

    return (
        <div
            className="thread-filter"
            role="radiogroup"
            aria-label="Thread filter options"
        >
            <div className="radio-button-group">
                <button
                    type="button"
                    ref={allButtonRef}
                    className={`filter-button ${
                        currentFilter === "all" ? "active" : ""
                    }`}
                    onClick={() => onFilterChange("all")}
                    onKeyDown={(e) => handleKeyDown(e, "all")}
                    role="radio"
                    aria-checked={currentFilter === "all"}
                    tabIndex={currentFilter === "all" ? 0 : -1}
                >
                    All
                </button>
                <button
                    type="button"
                    ref={commentsButtonRef}
                    className={`filter-button ${
                        currentFilter === "comments" ? "active" : ""
                    }`}
                    onClick={() => onFilterChange("comments")}
                    onKeyDown={(e) => handleKeyDown(e, "comments")}
                    role="radio"
                    aria-checked={currentFilter === "comments"}
                    tabIndex={currentFilter === "comments" ? 0 : -1}
                >
                    Comments
                </button>
            </div>
        </div>
    );
};
