import React from "react";
import style from "../PrViewer.module.css" with { type: "css" };

interface PrHeaderProps {
    id: number;
    title: string;
    status?: string;
    url?: string;
}

export const PrHeader: React.FC<PrHeaderProps> = ({
    id,
    title,
    status,
    url,
}) => {
    // Determine status class for styling
    const getStatusClass = (status: string | undefined): string => {
        if (!status) return "";
        if (status.toLowerCase() === "active") return style["status-active"];
        if (status.toLowerCase() === "completed")
            return style["status-completed"];
        if (status.toLowerCase() === "abandoned")
            return style["status-abandoned"];
        return "";
    };

    return (
        <div className={style["pr-details-header"]}>
            <div className={style["pr-details-header--titlestatus"]}>
                <h3 className={style["pr-title"]}>
                    <code>!{id}</code>: {title}
                </h3>
                <div>
                    {status && (
                        <span
                            className={`${
                                style["status-badge"]
                            } ${getStatusClass(status)}`}
                        >
                            {status}
                        </span>
                    )}
                </div>
            </div>
            {url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`button ${style["external-link"]}`}
                >
                    View in Browser
                </a>
            )}
        </div>
    );
};
