import React from "react";
import style from "../PrViewer.module.css" with { type: "css" };

interface PrBranchesProps {
    sourceBranch?: string;
    targetBranch?: string;
}

export const PrBranches: React.FC<PrBranchesProps> = ({
    sourceBranch,
    targetBranch,
}) => {
    // Format branch name (remove refs/heads/)
    const formatBranchName = (branchRef: string | undefined): string => {
        if (!branchRef) return "Unknown";
        return branchRef.replace("refs/heads/", "");
    };

    return (
        <div className={style["pr-branches"]}>
            <div className="branch source">
                <span className={style.label}>Source:</span>
                <span className={style["branch-name"]}>
                    {formatBranchName(sourceBranch)}
                </span>
            </div>
            <div className={style["branch-arrow"]}>→</div>
            <div className="branch target">
                <span className={style.label}>Target:</span>
                <span className={style["branch-name"]}>
                    {formatBranchName(targetBranch)}
                </span>
            </div>
        </div>
    );
};
