import React from "react";
import style from "../PrViewer.module.css" with { type: "css" };

interface PrMetadataProps {
    createdBy?: string;
    creationDate?: string;
    completionDate?: string;
    repository?: string;
    sourceBranch?: string;
    targetBranch?: string;
    mergeStatus?: string;
}

export const PrMetadata: React.FC<PrMetadataProps> = ({
    createdBy,
    creationDate,
    completionDate,
    repository,
    sourceBranch,
    targetBranch,
    mergeStatus,
}) => {
    // Format dates
    const formatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return "Not available";
        return new Date(dateStr).toLocaleString();
    };

    // Format branch name (remove refs/heads/)
    const formatBranchName = (branchRef: string | undefined): string => {
        if (!branchRef) return "Unknown";
        return branchRef.replace("refs/heads/", "");
    };

    return (
        <div className={style["pr-metadata"]}>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Created By</span>
                <span className={style["metadata-value"]}>
                    {createdBy || "Unknown"}
                </span>
            </div>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Creation Date</span>
                <span className={style["metadata-value"]}>
                    {formatDate(creationDate)}
                </span>
            </div>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Completion Date</span>
                <span className={style["metadata-value"]}>
                    {completionDate
                        ? formatDate(completionDate)
                        : "Not completed"}
                </span>
            </div>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Repository</span>
                <span className={style["metadata-value"]}>
                    {repository || "Unknown"}
                </span>
            </div>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Source Branch</span>
                <span className={style["metadata-value"]}>
                    {formatBranchName(sourceBranch)}
                </span>
            </div>
            <div className={style["metadata-item"]}>
                <span className={style["metadata-label"]}>Target Branch</span>
                <span className={style["metadata-value"]}>
                    {formatBranchName(targetBranch)}
                </span>
            </div>
            {mergeStatus && (
                <div className={style["metadata-item"]}>
                    <span className={style["metadata-label"]}>
                        Merge Status
                    </span>
                    <span className={style["metadata-value"]}>
                        {mergeStatus}
                    </span>
                </div>
            )}
        </div>
    );
};
