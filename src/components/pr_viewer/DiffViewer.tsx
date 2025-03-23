import React, { useState, useEffect, useMemo, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TreeDiff, FileDiff, DiffLine } from "../../types/interfaces";
import diffstyle from "./styles/diff.module.css";
import style from "../PrViewer.module.css" with { type: "css" };

interface DiffViewerProps {
    sourceBranch: string;
    targetBranch: string;
    filePattern?: string;
}

// Renders a file's diff content as a grid for better text selection
const FileContentGrid = memo(({ lines }: { lines: DiffLine[] }) => {
    // Create a map of line types for all rows in one pass
    const diffTypes = lines.map((line) => {
        switch (line.origin) {
            case "+":
                return "add";
            case "-":
                return "remove";
            case " ":
                return "unchanged";
            default:
                return "metadata"; // For any other origin character (hunk headers etc.)
        }
    });

    return (
        <div className={diffstyle.diffGrid}>
            {/* Separate gutter column for old line numbers */}
            <div className={diffstyle.gutterColumn}>
                {lines.map((line, i) => (
                    <div
                        key={`old-${i}`}
                        className={diffstyle.gutterLine}
                        data-diff-type={diffTypes[i]}
                    >
                        {line.old_lineno !== null ? line.old_lineno : " "}
                    </div>
                ))}
            </div>

            {/* Separate gutter column for new line numbers */}
            <div className={diffstyle.gutterColumn}>
                {lines.map((line, i) => (
                    <div
                        key={`new-${i}`}
                        className={diffstyle.gutterLine}
                        data-diff-type={diffTypes[i]}
                    >
                        {line.new_lineno !== null ? line.new_lineno : " "}
                    </div>
                ))}
            </div>

            {/* Content column with full text content */}
            <div className={diffstyle.contentColumn}>
                {lines.map((line, i) => (
                    <div
                        key={`content-${i}`}
                        className={diffstyle.contentLine}
                        data-diff-type={diffTypes[i]}
                    >
                        {line.content}
                    </div>
                ))}
            </div>
        </div>
    );
});

// Memoized file content component
const FileContent = memo(
    ({ file, isExpanded }: { file: FileDiff; isExpanded: boolean }) => {
        if (!isExpanded) return null;

        return (
            <div className={style["diff-file-content"]}>
                {file.binary ? (
                    <div className={style["diff-binary"]}>
                        Binary file not shown
                    </div>
                ) : (
                    <FileContentGrid lines={file.lines} />
                )}
            </div>
        );
    },
);

// Memoized file header component
const FileHeader = memo(
    ({
        file,
        isExpanded,
        onToggle,
    }: {
        file: FileDiff;
        isExpanded: boolean;
        onToggle: () => void;
    }) => {
        return (
            <div className={style["diff-file-header"]} onClick={onToggle}>
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
                    {file.status === "D" ? file.old_file : file.new_file}
                </span>
                <span className={style["diff-file-toggle"]}>
                    {isExpanded ? "▼" : "►"}
                </span>
            </div>
        );
    },
);

// Memoized file component
const FileView = memo(
    ({
        file,
        fileIndex,
        isExpanded,
        onToggle,
    }: {
        file: FileDiff;
        fileIndex: number;
        isExpanded: boolean;
        onToggle: () => void;
    }) => {
        return (
            <div key={`file-${fileIndex}`} className={style["diff-file"]}>
                <FileHeader
                    file={file}
                    isExpanded={isExpanded}
                    onToggle={onToggle}
                />
                <FileContent file={file} isExpanded={isExpanded} />
            </div>
        );
    },
);

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
                console.log(diff);
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

    const metadata = useMemo(
        () => (
            <p>
                {sourceBranch} -- {targetBranch}
            </p>
        ),
        [sourceBranch, targetBranch],
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

    if (!treeDiff || treeDiff.files.length === 0) {
        return <div>No differences found between branches. {metadata}</div>;
    }

    return (
        <div className={style["pr-section"]}>
            <h3>Changes</h3>
            {metadata}
            <div className={style["diff-container"]}>
                {treeDiff.files.map((file, fileIndex) => (
                    <FileView
                        key={file.new_file || file.old_file}
                        file={file}
                        fileIndex={fileIndex}
                        isExpanded={expandedFiles[file.new_file]}
                        onToggle={() => toggleFileExpansion(file.new_file)}
                    />
                ))}
            </div>
        </div>
    );
};
