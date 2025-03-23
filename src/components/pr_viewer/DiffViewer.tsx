import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TreeDiff, FileDiff } from "../../types/interfaces";
import diffstyle from "./styles/diff.module.css";
import style from "../PrViewer.module.css" with { type: "css" };

interface DiffViewerProps {
    sourceBranch: string;
    targetBranch: string;
    filePattern?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
    sourceBranch,
    targetBranch,
    filePattern,
}) => {
    const [treeDiff, setTreeDiff] = useState<TreeDiff | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
        {},
    );

    useEffect(() => {
        const fetchDiff = async () => {
            setLoading(true);
            setError(null);
            try {
                const diff = await (filePattern
                    ? invoke<TreeDiff>("git_get_file_diff_between_revisions", {
                          fromRevision: targetBranch,
                          toRevision: sourceBranch,
                          filePattern: filePattern || null,
                      })
                    : invoke<TreeDiff>("git_get_tree_diff_between_revisions", {
                          fromRevision: targetBranch,
                          toRevision: sourceBranch,
                      }));
                setTreeDiff(diff);

                // Initialize expanded state for each file
                const initialExpandedState: Record<string, boolean> = {};
                diff.files.forEach((file) => {
                    initialExpandedState[file.new_file] = true;
                });
                setExpandedFiles(initialExpandedState);
            } catch (err) {
                setError(`Failed to get diff: ${err}`);
                console.error("Diff error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDiff();
    }, [sourceBranch, targetBranch, filePattern]);

    const toggleFileExpansion = (fileName: string) => {
        setExpandedFiles((prev) => ({
            ...prev,
            [fileName]: !prev[fileName],
        }));
    };

    const metadata = (
        <p>
            {sourceBranch} -- {targetBranch}
        </p>
    );

    if (loading) {
        return <div className={style.loading}>Loading diff... {metadata}</div>;
    }

    if (error) {
        return (
            <div className={style.error}>
                {error} {metadata}
            </div>
        );
    }

    console.log("🚀 ~ treeDiff:", treeDiff);
    if (!treeDiff || treeDiff.files.length === 0) {
        return <div>No differences found between branches. {metadata}</div>;
    }

    return (
        <div className={style["pr-section"]}>
            <h3>Changes</h3>
            {metadata}
            <div className={style["diff-container"]}>
                {treeDiff.files.map((file, fileIndex) => (
                    <div
                        key={`file-${fileIndex}`}
                        className={style["diff-file"]}
                    >
                        <div
                            className={style["diff-file-header"]}
                            onClick={() => toggleFileExpansion(file.new_file)}
                        >
                            <span className={style["diff-file-status"]}>
                                {file.status === "A"
                                    ? "Added"
                                    : file.status === "M"
                                      ? "Modified"
                                      : file.status === "D"
                                          ? "Deleted"
                                          : file.status}
                            </span>
                            <span className={style["diff-file-name"]}>
                                {file.status === "D"
                                    ? file.old_file
                                    : file.new_file}
                            </span>
                            <span className={style["diff-file-toggle"]}>
                                {expandedFiles[file.new_file] ? "▼" : "►"}
                            </span>
                        </div>

                        {expandedFiles[file.new_file] && (
                            <div className={style["diff-file-content"]}>
                                {file.binary ? (
                                    <div className={style["diff-binary"]}>
                                        Binary file not shown
                                    </div>
                                ) : (
                                    <pre>
                                        {file.lines.map((line, lineIndex) => {
                                            let lineClass = "";
                                            switch (line.origin) {
                                                case "+":
                                                    lineClass =
                                                        diffstyle.diffAdd;
                                                    break;
                                                case "-":
                                                    lineClass =
                                                        diffstyle.diffRemove;
                                                    break;
                                                default:
                                                    lineClass =
                                                        diffstyle.diffUnchanged;
                                            }

                                            return (
                                                <div
                                                    key={`line-${lineIndex}`}
                                                    className={lineClass}
                                                >
                                                    <span
                                                        className={
                                                            style[
                                                                "diff-line-numbers"
                                                            ]
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                style[
                                                                    "diff-old-line-number"
                                                                ]
                                                            }
                                                        >
                                                            {line.old_lineno !==
                                                            null
                                                                ? line.old_lineno
                                                                : " "}
                                                        </span>
                                                        <span
                                                            className={
                                                                style[
                                                                    "diff-new-line-number"
                                                                ]
                                                            }
                                                        >
                                                            {line.new_lineno !==
                                                            null
                                                                ? line.new_lineno
                                                                : " "}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className={
                                                            style[
                                                                "diff-line-content"
                                                            ]
                                                        }
                                                    >
                                                        {line.content}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
