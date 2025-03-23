import type React from "react";
import { Markdown } from "../Markdown";
import style from "../PrViewer.module.css" with { type: "css" };

interface PrDescriptionProps {
    description?: string;
}

export const PrDescription: React.FC<PrDescriptionProps> = ({
    description,
}) => {
    if (!description) return null;

    return (
        <div className={style["pr-description"]}>
            <h4 className={style["description-title"]}>Description</h4>
            <div className={style["description-content"]}>
                <Markdown markdown={description} />
            </div>
        </div>
    );
};
