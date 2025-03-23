import React, { useState, useEffect, useMemo, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TreeDiff, FileDiff, DiffLine } from "../../types/interfaces";
import diffstyle from "./styles/diff.module.css";
import style from "../PrViewer.module.css" with { type: "css" };
import { Highlight, themes } from "prism-react-renderer";
import "./styles/diff.overrides.css";

function createCodeHunks(
    lines: DiffLine[],
    diffTypes: string[],
): {
    codeHunks: {
        text: string[];
        startLine: number;
        endLine: number;
        type: string;
    }[];
    idxUnexpectedLineCount: Map<number, number>;
} {
    const codeHunks: {
        text: string[];
        startLine: number;
        endLine: number;
        type: string;
    }[] = [];

    const idxUnexpectedLineCount = new Map<number, number>();
    let addedLines = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineInfo = lines[lineIdx];
        const currentType = diffTypes[lineIdx];

        // Get the last hunk if it exists
        const hunk =
            codeHunks.length > 0 ? codeHunks[codeHunks.length - 1] : undefined;

        const contentLines = lineInfo.content.split("\n");
        const extraLinesCount = contentLines.length - 1;

        if (hunk && hunk.type === currentType) {
            hunk.text.push(...contentLines);
            if (extraLinesCount) {
                idxUnexpectedLineCount.set(lineIdx, extraLinesCount);
            }
            addedLines += extraLinesCount;
        } else {
            // Close the previous hunk if it exists
            if (hunk) {
                hunk.endLine = lineIdx + addedLines;
            }

            if (extraLinesCount) {
                idxUnexpectedLineCount.set(lineIdx, extraLinesCount);
            }
            // Create a new hunk
            codeHunks.push({
                text: contentLines,
                type: currentType,
                startLine: lineIdx + addedLines,
                endLine: lineIdx + (addedLines += extraLinesCount),
            });
        }
    }

    return { codeHunks, idxUnexpectedLineCount };
}

/**
 * @param codeHunks MUST BE SORTED by startLine
 */
function findCodeHunkByLineNumber(
    lineNumber: number,
    codeHunks: {
        text: string[];
        startLine: number;
        endLine: number;
        type: string;
    }[],
):
    | {
          text: string[];
          startLine: number;
          endLine: number;
          type: string;
      }
    | undefined {
    // Sort hunks by startLine if not already sorted
    // const sortedHunks = [...codeHunks].sort((a, b) => a.startLine - b.startLine);

    // Binary search to find the hunk containing the line number
    let left = 0;
    let right = codeHunks.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const hunk = codeHunks[mid];

        // Check if the line number is within this hunk's range
        if (lineNumber >= hunk.startLine && lineNumber < hunk.endLine) {
            return hunk;
        }

        // Decide which half to search next
        if (lineNumber < hunk.startLine) {
            // Line number is in the left half
            right = mid - 1;
        } else {
            // Line number is in the right half
            left = mid + 1;
        }
    }

    // Return undefined if no matching hunk is found
    return undefined;
}

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

    const { codeHunks, idxUnexpectedLineCount } = createCodeHunks(
        lines,
        diffTypes,
    );
    const codeText = codeHunks.flatMap((h) => h.text).join("\n");

    console.log(codeHunks);

    /**
     * the content lines received from the backend, but expanding 'lines' (like
     * git metadata) that have `\n` characters to multiple lines for rendering.
     */
    const filledOutLines = lines.flatMap((line, i) =>
        Array(1 + (idxUnexpectedLineCount.get(i) || 0)).fill(line),
    );

    return (
        <div className={diffstyle.diffGrid}>
            {/* Separate gutter column for old line numbers */}
            <div className={diffstyle.gutterColumn}>
                {filledOutLines.map((line, i) => (
                    <div
                        key={`old-${i}`}
                        className={diffstyle.gutterLine}
                        data-diff-type={
                            findCodeHunkByLineNumber(i, codeHunks)?.type
                        }
                    >
                        {line.old_lineno !== null ? line.old_lineno : " "}
                    </div>
                ))}
            </div>

            {/* Separate gutter column for new line numbers */}
            <div className={diffstyle.gutterColumn}>
                {filledOutLines.map((line, i) => (
                    <div
                        key={`new-${i}`}
                        className={diffstyle.gutterLine}
                        data-diff-type={
                            findCodeHunkByLineNumber(i, codeHunks)?.type
                        }
                    >
                        {line.new_lineno !== null ? line.new_lineno : " "}
                    </div>
                ))}
            </div>

            {/* Content column with full text content */}
            {/* <div className={diffstyle.contentColumn}> */}
            <Highlight
                theme={themes.nightOwlLight}
                code={codeText}
                language="tsx"
            >
                {({
                    className,
                    style,
                    tokens,
                    getLineProps,
                    getTokenProps,
                }) => (
                    <div
                        style={style}
                        className={`${className} ${diffstyle.contentColumn}`}
                    >
                        {tokens.map((line, i) => (
                            <div
                                key={i}
                                {...getLineProps({ line })}
                                className={diffstyle.contentLine}
                                data-diff-type={
                                    findCodeHunkByLineNumber(i, codeHunks)?.type
                                }
                            >
                                {line.map((token, key) => (
                                    <span
                                        key={key}
                                        {...getTokenProps({ token })}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </Highlight>
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
            <span className={diffstyle.filesChangedRefMeta}>
                <code>{targetBranch}</code> <code>--&gt;</code>{" "}
                <code>{sourceBranch}</code>
            </span>
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
            <div className={style["diff-header"]}>
                <h3>Files Changed</h3>
                {metadata}
            </div>
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
