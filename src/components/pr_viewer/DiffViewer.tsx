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
const FileContentGrid = memo(
    ({
        lines,
        highlightLineRange,
        isTargetFile,
    }: {
        lines: DiffLine[];
        highlightLineRange?: { start: number; end: number } | null;
        isTargetFile: boolean;
    }) => {
        // Create a ref for the first highlighted line
        const highlightedLineRef = React.useRef<HTMLDivElement>(null);
        const hasScrolledToLine = React.useRef<boolean>(false);

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

        /**
         * the content lines received from the backend, but expanding 'lines' (like
         * git metadata) that have `\n` characters to multiple lines for rendering.
         */
        const filledOutLines = lines.flatMap((line, i) =>
            Array(1 + (idxUnexpectedLineCount.get(i) || 0)).fill(line),
        );

        // Function to determine if a line should be highlighted
        const shouldHighlightLine = (lineNumber: number | null) => {
            if (!highlightLineRange || lineNumber === null) return false;
            return (
                lineNumber >= highlightLineRange.start &&
                lineNumber <= highlightLineRange.end
            );
        };

        // Effect to scroll to the first highlighted line
        useEffect(() => {
            if (
                isTargetFile &&
                highlightLineRange &&
                highlightedLineRef.current &&
                !hasScrolledToLine.current
            ) {
                // Delay to ensure rendering is complete
                setTimeout(() => {
                    if (highlightedLineRef.current) {
                        highlightedLineRef.current.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                        hasScrolledToLine.current = true;
                    }
                }, 150);
            }
        }, [isTargetFile, highlightLineRange]);

        return (
            <div className={diffstyle.diffGrid}>
                {/* Separate gutter column for old line numbers */}
                <div className={diffstyle.gutterColumn}>
                    {filledOutLines.map((line, i) => (
                        <div
                            key={`old-${i}`}
                            className={`${diffstyle.gutterLine} ${
                                shouldHighlightLine(line.old_lineno)
                                    ? diffstyle.highlightedLine
                                    : ""
                            }`}
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
                            className={`${diffstyle.gutterLine} ${
                                shouldHighlightLine(line.new_lineno)
                                    ? diffstyle.highlightedLine
                                    : ""
                            }`}
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
                    theme={themes.nightOwl}
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
                            {tokens.map((line, i) => {
                                // Check if this is a line that should be highlighted
                                const isHighlighted = shouldHighlightLine(
                                    filledOutLines[i]?.new_lineno,
                                );

                                // Check if this is the first highlighted line
                                const isFirstHighlightedLine =
                                    isHighlighted &&
                                    filledOutLines[i]?.new_lineno ===
                                        highlightLineRange?.start;

                                return (
                                    <div
                                        key={i}
                                        ref={
                                            isFirstHighlightedLine
                                                ? highlightedLineRef
                                                : null
                                        }
                                        {...getLineProps({ line })}
                                        className={`${diffstyle.contentLine} ${
                                            isHighlighted
                                                ? diffstyle.highlightedLine
                                                : ""
                                        }`}
                                        data-diff-type={
                                            findCodeHunkByLineNumber(
                                                i,
                                                codeHunks,
                                            )?.type
                                        }
                                    >
                                        {line.map((token, key) => (
                                            <span
                                                key={key}
                                                {...getTokenProps({ token })}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Highlight>
            </div>
        );
    },
);

// Memoized file content component
const FileContent = memo(
    ({
        file,
        isExpanded,
        highlightLineRange,
        isTargetFile,
    }: {
        file: FileDiff;
        isExpanded: boolean;
        highlightLineRange?: { start: number; end: number } | null;
        isTargetFile: boolean;
    }) => {
        if (!isExpanded) return null;

        return (
            <div className={style["diff-file-content"]}>
                {file.binary ? (
                    <div className={style["diff-binary"]}>
                        Binary file not shown
                    </div>
                ) : (
                    <FileContentGrid
                        lines={file.lines}
                        highlightLineRange={highlightLineRange}
                        isTargetFile={isTargetFile}
                    />
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
        // Create a custom style that enhances the sticky behavior
        const headerStyle: React.CSSProperties = {
            position: "sticky",
            top: 0,
            zIndex: 10,
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        };

        return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: you can use tabindex instead
            <div
                className={style["diff-file-header"]}
                onClick={onToggle}
                style={headerStyle}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: goddamnit biome lol
                tabIndex={0}
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
        isTargetFile,
        highlightLineRange,
    }: {
        file: FileDiff;
        fileIndex: number;
        isExpanded: boolean;
        onToggle: () => void;
        isTargetFile: boolean;
        highlightLineRange?: { start: number; end: number } | null;
    }) => {
        const fileRef = React.useRef<HTMLDivElement>(null);
        const headerRef = React.useRef<HTMLDivElement>(null);

        // Scroll to this file if it's the target file
        // The specific line scrolling is handled by the FileContentGrid
        useEffect(() => {
            if (isTargetFile && fileRef.current) {
                // Use a small timeout to ensure the file is expanded before scrolling
                setTimeout(() => {
                    fileRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                }, 100);
            }
        }, [isTargetFile, isExpanded]);

        // Custom styles to ensure the sticky header works correctly
        const stickyWrapperStyle: React.CSSProperties = {
            position: "relative",
        };

        // Set the sticky position directly on the header element
        // Position this below the PR header (currently exactly 92px, we should
        // probably change this to be less...)
        const headerStyle: React.CSSProperties = {
            position: "sticky",
            top: "92px",
            zIndex: 98, // Below the main PR header
            backgroundColor: "var(--hover-color)",
            borderBottom: "1px solid var(--border-color)",
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            // Only include bottom border radius when collapsed
            borderBottomLeftRadius: isExpanded ? "0" : "8px",
            borderBottomRightRadius: isExpanded ? "0" : "8px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        };

        // Style for the container div that adapts based on expanded state
        const containerStyle: React.CSSProperties = {
            ...stickyWrapperStyle,
            borderRadius: "8px",
            overflow: isExpanded ? "visible" : "hidden",
        };

        return (
            <div
                ref={fileRef}
                key={`file-${fileIndex}`}
                style={containerStyle}
                className={`${style["diff-file"]} ${
                    isTargetFile ? style["diff-file-highlight"] : ""
                }`}
            >
                <div ref={headerRef} style={headerStyle}>
                    <FileHeader
                        file={file}
                        isExpanded={isExpanded}
                        onToggle={onToggle}
                    />
                </div>
                <FileContent
                    file={file}
                    isExpanded={isExpanded}
                    highlightLineRange={highlightLineRange}
                    isTargetFile={isTargetFile}
                />
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
    const [fileToScrollTo, setFileToScrollTo] = useState<string | null>(null);
    const [parsedLineRange, setParsedLineRange] = useState<{
        start: number;
        end: number;
    } | null>(null);

    // Check for file to scroll to from sessionStorage
    useEffect(() => {
        const scrollToFile = sessionStorage.getItem("scrollToFile");
        if (scrollToFile) {
            setFileToScrollTo(scrollToFile);

            const scrollToLineRange =
                sessionStorage.getItem("scrollToLineRange");
            if (scrollToLineRange) {
                // Parse the line range string to get start and end line numbers
                const lineMatch =
                    scrollToLineRange.match(/Line (\d+)/) ||
                    scrollToLineRange.match(/Lines (\d+)-(\d+)/);

                if (lineMatch) {
                    if (lineMatch.length === 2) {
                        // Single line format: "Line X"
                        const lineNumber = parseInt(lineMatch[1], 10);
                        setParsedLineRange({
                            start: lineNumber,
                            end: lineNumber,
                        });
                    } else if (lineMatch.length === 3) {
                        // Range format: "Lines X-Y"
                        const startLine = parseInt(lineMatch[1], 10);
                        const endLine = parseInt(lineMatch[2], 10);
                        setParsedLineRange({ start: startLine, end: endLine });
                    }
                }
            }

            // Clear sessionStorage after retrieving values
            sessionStorage.removeItem("scrollToFile");
            sessionStorage.removeItem("scrollToLineRange");
        }
    }, []);

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
                    // Auto-expand the file to scroll to, or all files if none specified
                    const isTargetFile =
                        fileToScrollTo &&
                        (file.new_file === fileToScrollTo ||
                            file.old_file === fileToScrollTo);

                    initialExpandedState[file.new_file] =
                        isTargetFile || fileToScrollTo === null;
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
    }, [sourceBranch, targetBranch, filePattern, fileToScrollTo]);

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
                {treeDiff.files.map((file, fileIndex) => {
                    const isTargetFile =
                        fileToScrollTo &&
                        (file.new_file === fileToScrollTo ||
                            file.old_file === fileToScrollTo);

                    return (
                        <FileView
                            key={file.new_file || file.old_file}
                            file={file}
                            fileIndex={fileIndex}
                            isExpanded={expandedFiles[file.new_file]}
                            onToggle={() => toggleFileExpansion(file.new_file)}
                            isTargetFile={!!isTargetFile}
                            highlightLineRange={
                                isTargetFile ? parsedLineRange : null
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
};
