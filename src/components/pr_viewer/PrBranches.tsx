import type React from "react";
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
            <div className={`${style.branch} ${style.source}`}>
                <span className={style.label}>Source:</span>
                <div className={style["branch-name"]}>
                    {formatBranchName(sourceBranch)}
                </div>
            </div>
            <div className={style["branch-arrow"]}>→</div>
            <div className={`${style.branch} ${style.target}`}>
                <span className={style.label}>Target:</span>
                <div className={style["branch-name"]}>
                    {formatBranchName(targetBranch)}
                </div>
            </div>
        </div>
    );
};
