import type React from "react";
import { useMemo } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import type { PrData } from "../types/interfaces";
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
    const location = useLocation();
    const { pathname } = location;
    const activeTab = pathname.includes("/changes") ? "changes" : "overview";
    const { prNumber } = useParams<{ prNumber: string }>();

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
            <div className={style["pr-details"]}>
                <div className={style["pr-card"]}>
                    <PrHeader
                        id={prData.id}
                        title={prData.title}
                        status={prData.status}
                        url={prData.url}
                    />

                    <div className={style["pr-tabs"]}>
                        <Link
                            to={`/pr/${prNumber}/overview`}
                            className={`${style["tab-button"]} ${
                                activeTab === "overview"
                                    ? style["active-tab"]
                                    : ""
                            }`}
                        >
                            Overview
                        </Link>
                        <Link
                            to={`/pr/${prNumber}/changes`}
                            className={`${style["tab-button"]} ${
                                activeTab === "changes"
                                    ? style["active-tab"]
                                    : ""
                            }`}
                        >
                            Changes
                        </Link>
                    </div>

                    {activeTab === "overview" && (
                        <>
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

                            {prData.threads && (
                                <ThreadsSection threads={prData.threads} />
                            )}
                        </>
                    )}

                    {activeTab === "changes" &&
                        prData.last_merge_target_commit &&
                        prData.last_merge_commit && (
                            <DiffViewer
                                sourceBranch={prData.last_merge_commit}
                                targetBranch={prData.last_merge_target_commit}
                            />
                        )}

                    {activeTab === "changes" &&
                        (!prData.last_merge_source_commit ||
                            !prData.last_merge_target_commit) && (
                            <div className={style["pr-section"]}>
                                <h3>Changes</h3>
                                <p>
                                    Cannot display diff data. Missing commit
                                    information.
                                </p>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
};

export default PrViewer;
