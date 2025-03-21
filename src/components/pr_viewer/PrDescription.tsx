import React from "react";
import { Markdown } from "../Markdown";

interface PrDescriptionProps {
    description?: string;
}

export const PrDescription: React.FC<PrDescriptionProps> = ({
    description,
}) => {
    if (!description) return null;

    return (
        <div className="pr-description">
            <h4 className="description-title">Description</h4>
            <div className="description-content">
                <Markdown markdown={description} />
            </div>
        </div>
    );
};
