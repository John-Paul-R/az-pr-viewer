import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { PrData } from "../types/interfaces";
import "./PrViewer.css";

interface PrViewerProps {
    prData: PrData | null;
    onBack: () => void;
}

const PrViewer: React.FC<PrViewerProps> = ({ prData, onBack }) => {
    const [error, setError] = useState<string>("");

    if (!prData) {
        return (
            <div className="error-container">
                <p className="error">
                    No PR data found. Please select a PR file from the main
                    page.
                </p>
                <button onClick={onBack} className="back-button">
                    Back to PR List
                </button>
            </div>
        );
    }

    // Helper function to escape HTML special characters
    const escapeHtml = (text: string | undefined): string => {
        if (typeof text !== "string") return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Format dates
    const formatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return "Not available";
        return new Date(dateStr).toLocaleString();
    };

    // Determine status class for styling
    const getStatusClass = (status: string | undefined): string => {
        if (!status) return "";

        if (status.toLowerCase() === "active") return "status-active";
        if (status.toLowerCase() === "completed") return "status-completed";
        if (status.toLowerCase() === "abandoned") return "status-abandoned";

        return "";
    };

    // Format branch name (remove refs/heads/)
    const formatBranchName = (branchRef: string | undefined): string => {
        if (!branchRef) return "Unknown";
        return branchRef.replace("refs/heads/", "");
    };

    // Render PR card
    return (
        <div className="pr-details">
            <div className="pr-header">
                <button onClick={onBack} className="back-button">
                    Back to PR List
                </button>
                <h1>Pull Request Viewer</h1>
            </div>

            <div className="pr-card">
                <div className="pr-header">
                    <div>
                        <h3 className="pr-title">{prData.title}</h3>
                        <div>
                            <span
                                className={`status-badge ${getStatusClass(
                                    prData.status,
                                )}`}
                            >
                                {prData.status}
                            </span>
                        </div>
                    </div>
                    {prData.url && (
                        <div className="external-link">
                            <a
                                href={prData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View in Browser
                            </a>
                        </div>
                    )}
                </div>

                <div className="pr-metadata">
                    <div className="metadata-item">
                        <span className="metadata-label">Created By</span>
                        <span className="metadata-value">
                            {prData.created_by}
                        </span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-label">Creation Date</span>
                        <span className="metadata-value">
                            {formatDate(prData.creation_date)}
                        </span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-label">Completion Date</span>
                        <span className="metadata-value">
                            {prData.completion_date
                                ? formatDate(prData.completion_date)
                                : "Not completed"}
                        </span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-label">Repository</span>
                        <span className="metadata-value">
                            {prData.repository}
                        </span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-label">Source Branch</span>
                        <span className="metadata-value">
                            {formatBranchName(prData.source_branch)}
                        </span>
                    </div>
                    <div className="metadata-item">
                        <span className="metadata-label">Target Branch</span>
                        <span className="metadata-value">
                            {formatBranchName(prData.target_branch)}
                        </span>
                    </div>
                </div>

                <div className="pr-branches">
                    <div className="branch source">
                        <span className="label">Source:</span>
                        <span className="branch-name">
                            {formatBranchName(prData.source_branch)}
                        </span>
                    </div>
                    <div className="branch-arrow">→</div>
                    <div className="branch target">
                        <span className="label">Target:</span>
                        <span className="branch-name">
                            {formatBranchName(prData.target_branch)}
                        </span>
                    </div>
                </div>

                {/* Add threads section if there are any */}
                {prData.threads && prData.threads.length > 0 ? (
                    <div className="threads-section">
                        <h3>
                            Activity (
                            {
                                prData.threads.filter(
                                    (thread) => !thread.isDeleted,
                                ).length
                            }{" "}
                            items)
                        </h3>

                        {/* Sort threads by publishedDate */}
                        {[...prData.threads]
                            .filter((thread) => !thread.isDeleted)
                            .sort(
                                (a, b) =>
                                    new Date(a.publishedDate).getTime() -
                                    new Date(b.publishedDate).getTime(),
                            )
                            .map((thread, threadIndex) => {
                                // Check if this is a system notification thread
                                const isSystemThread =
                                    thread.comments &&
                                    thread.comments.length === 1 &&
                                    thread.comments[0] &&
                                    (thread.comments[0].commentType ===
                                        "system" ||
                                        (thread.comments[0].author &&
                                            thread.comments[0].author
                                                .displayName &&
                                            thread.comments[0].author.displayName.includes(
                                                "Microsoft.VisualStudio.Services.TFS",
                                            )));

                                if (
                                    isSystemThread &&
                                    thread.comments &&
                                    thread.comments.length > 0
                                ) {
                                    // Render as a system notification
                                    const comment = thread.comments[0];

                                    return (
                                        <div
                                            className="system-notification"
                                            key={`thread-${threadIndex}`}
                                        >
                                            <div className="notification-time">
                                                {new Date(
                                                    comment.publishedDate,
                                                ).toLocaleString()}
                                            </div>
                                            <div className="notification-content">
                                                {comment.content && (
                                                    <ReactMarkdown>
                                                        {comment.content}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                // Render as a regular comment thread
                                let filePath = "";
                                if (
                                    thread.threadContext &&
                                    thread.threadContext.filePath
                                ) {
                                    filePath = thread.threadContext.filePath;
                                }

                                return (
                                    <div
                                        className="thread"
                                        key={`thread-${threadIndex}`}
                                    >
                                        <div className="thread-header">
                                            <div>
                                                {filePath ? (
                                                    <span className="file-path">
                                                        {escapeHtml(filePath)}
                                                    </span>
                                                ) : (
                                                    "General comment"
                                                )}
                                            </div>
                                            <div>
                                                Thread started on{" "}
                                                {new Date(
                                                    thread.publishedDate,
                                                ).toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Add comments if there are any */}
                                        {thread.comments &&
                                        thread.comments.length > 0 ? (
                                            thread.comments
                                                .filter(
                                                    (comment) =>
                                                        !comment.isDeleted,
                                                )
                                                .map(
                                                    (comment, commentIndex) => {
                                                        // Check if markdown is supported for this comment thread
                                                        const supportsMarkdown =
                                                            thread.properties &&
                                                            thread.properties[
                                                                "Microsoft.TeamFoundation.Discussion.SupportsMarkdown"
                                                            ] &&
                                                            thread.properties[
                                                                "Microsoft.TeamFoundation.Discussion.SupportsMarkdown"
                                                            ].$value === 1;

                                                        return (
                                                            <div
                                                                className="comment"
                                                                key={`comment-${commentIndex}`}
                                                            >
                                                                <div className="comment-header">
                                                                    <div className="comment-author">
                                                                        {comment.author &&
                                                                        comment
                                                                            .author
                                                                            .displayName
                                                                            ? escapeHtml(
                                                                                  comment
                                                                                      .author
                                                                                      .displayName,
                                                                              )
                                                                            : "Unknown"}
                                                                    </div>
                                                                    <div className="comment-date">
                                                                        {new Date(
                                                                            comment.publishedDate,
                                                                        ).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className="comment-content">
                                                                    {comment.content &&
                                                                        (supportsMarkdown ? (
                                                                            <ReactMarkdown
                                                                                rehypePlugins={[
                                                                                    rehypeSanitize,
                                                                                    rehypeRaw,
                                                                                ]}
                                                                            >
                                                                                {
                                                                                    comment.content
                                                                                }
                                                                            </ReactMarkdown>
                                                                        ) : (
                                                                            <div
                                                                                style={{
                                                                                    whiteSpace:
                                                                                        "pre-wrap",
                                                                                }}
                                                                            >
                                                                                {
                                                                                    comment.content
                                                                                }
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    },
                                                )
                                        ) : (
                                            <div className="comment">
                                                No comments in this thread.
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="threads-section">
                        <h3>Activity</h3>
                        <p>No activity on this pull request.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrViewer;
