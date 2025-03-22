import React from "react";
import style from "../PrViewer.module.css" with { type: "css" };

interface ErrorContainerProps {
    message: string;
    onBack: () => void;
}

export const ErrorContainer: React.FC<ErrorContainerProps> = ({
    message,
    onBack,
}) => {
    return (
        <div className={style["error-container"]}>
            <p className={style.error}>{message}</p>
            <button onClick={onBack} className={style["back-button"]}>
                Back to PR List
            </button>
        </div>
    );
};
