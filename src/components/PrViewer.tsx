import React, { useMemo } from "react";
import { PrData } from "../types/interfaces";
import {
    PrHeader,
    PrMetadata,
    PrBranches,
    ThreadsSection,
    ErrorContainer,
    PrDescription,
    PrReviewers,
    DiffViewer,
} from "./pr_viewer";
import { enrichReviewersWithAvatars } from "./pr_viewer/helpers/voteParser";
import style from "./PrViewer.module.css" with { type: "css" };

interface PrViewerProps {
    prData: PrData | null;
    onBack: () => void;
}

const PrViewer: React.FC<PrViewerProps> = ({ prData, onBack }) => {
    if (!prData) {
        return (
            <ErrorContainer
                message="No PR data found. Please select a PR file from the main page."
                onBack={onBack}
            />
        );
    }

    // Enrich reviewers with avatars from thread data if available
    const enrichedReviewers = useMemo(() => {
        if (prData.reviewers && prData.threads) {
            return enrichReviewersWithAvatars(prData.reviewers, prData.threads);
        }
        return prData.reviewers;
    }, [prData.reviewers, prData.threads]);

    return (
        <div className={style["pr-details-scroll-wrapper"]}>
            <button onClick={onBack} className={style["back-button"]}>
                Back to PR List
            </button>
            {/* <div className="pr-header">
                <h1>Pull Request Viewer</h1>
            </div> */}
            <div className={style["pr-details"]}>
                <div className={style["pr-card"]}>
                    <PrHeader
                        id={prData.id}
                        title={prData.title}
                        status={prData.status}
                        url={prData.url}
                    />

                    <PrDescription description={prData.description} />

                    <PrMetadata
                        createdBy={prData.created_by}
                        creationDate={prData.creation_date}
                        completionDate={prData.completion_date}
                        repository={prData.repository}
                        sourceBranch={prData.source_branch}
                        targetBranch={prData.target_branch}
                        mergeStatus={prData.merge_status}
                    />

                    <PrReviewers reviewers={enrichedReviewers} />

                    <PrBranches
                        sourceBranch={prData.source_branch}
                        targetBranch={prData.target_branch}
                    />

                    {/* {JSON.stringify(prData)} */}
                    {prData.last_merge_source_commit &&
                    prData.last_merge_target_commit ? (
                        <DiffViewer
                            sourceBranch={prData.last_merge_source_commit}
                            targetBranch={prData.last_merge_target_commit}
                        />
                    ) : (
                        <>cannot display diff data</>
                    )}

                    {prData.threads && (
                        <ThreadsSection threads={prData.threads} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrViewer;
