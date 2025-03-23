import type React from "react";
import style from "../PrViewer.module.css"; // with { type: "css" };
import badgestyle from "../badges.module.css"; // with { type: "css" };

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
        switch (status?.toLowerCase()) {
            case "active":
                return badgestyle["status-active"];
            case "completed":
                return badgestyle["status-completed"];
            case "abandoned":
                return badgestyle["status-abandoned"];
            default:
                return "";
        }
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
                                badgestyle["status-badge"]
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
