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
} from "./pr_viewer";
import { enrichReviewersWithAvatars } from "./pr_viewer/helpers/voteParser";
import "./PrViewer.css";

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
        <div className="pr-details">
            <div className="pr-header">
                <button onClick={onBack} className="back-button">
                    Back to PR List
                </button>
                <h1>Pull Request Viewer</h1>
            </div>

            <div className="pr-card">
                <PrHeader
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

                {prData.threads && <ThreadsSection threads={prData.threads} />}
            </div>
        </div>
    );
};

export default PrViewer;
