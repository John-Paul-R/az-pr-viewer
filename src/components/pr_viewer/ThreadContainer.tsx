import { invoke } from "@tauri-apps/api/core";
import React, { type DependencyList, type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Thread } from "../../types/interfaces";
import style from "../PrViewer.module.css" with { type: "css" };
import { ThreadComment } from "./ThreadComment";
import diffstyle from "./styles/diff.module.css";

function useAsyncMemo<T>(
    fn: () => Promise<T>,
    deps: DependencyList,
): T | undefined {
    const [value, setValue] = useState<T>();
    useEffect(() => {
        fn().then(setValue);
    }, [fn, ...deps]);
    return value;
}

interface ThreadContainerProps {
    thread: Thread;
}

export const ThreadContainer: React.FC<ThreadContainerProps> = ({ thread }) => {
    const navigate = useNavigate();
    const { prNumber } = useParams<{ prNumber: string }>();
    let filePath = "";
    let lineRange = "";

    if (thread.threadContext?.filePath) {
        filePath = thread.threadContext.filePath;

        // Add line number range if available
        if (
            thread.threadContext.rightFileStart &&
            thread.threadContext.rightFileEnd
        ) {
            const startLine = thread.threadContext.rightFileStart.line;
            const endLine = thread.threadContext.rightFileEnd.line;

            if (startLine === endLine) {
                lineRange = `Line ${startLine}`;
            } else {
                lineRange = `Lines ${startLine}-${endLine}`;
            }
        }
    }

    const navigateToFileView = () => {
        if (filePath && prNumber) {
            // Store the file path and line range in sessionStorage to retrieve later
            // remove the leading '/' because Files page doesn't use it for git2 compatibility reasons
            sessionStorage.setItem("scrollToFile", filePath.slice(1));
            if (lineRange) {
                sessionStorage.setItem("scrollToLineRange", lineRange);
            }
            // Navigate to changes view
            navigate(`/pr/${prNumber}/changes`);
        }
    };

    const diffFileContent = useAsyncMemo(async () => {
        if (
            thread.threadContext?.filePath &&
            thread.threadContext.rightFileStart &&
            thread.threadContext.rightFileEnd &&
            thread.pullRequestThreadContext?.firstIterationDetails
        ) {
            return (await invoke("git_get_file_diff_between_revisions", {
                // git2 wants relative paths, and all these state with `/` -- it
                // also doesn't want the value to start with '.'
                filePath: thread.threadContext.filePath.slice(1),
                fromRevision:
                    thread.pullRequestThreadContext?.firstIterationDetails
                        .targetCommit,
                toRevision:
                    thread.pullRequestThreadContext?.firstIterationDetails
                        .sourceCommit,
                startLine: thread.threadContext.rightFileStart.line,
                endLine: thread.threadContext.rightFileEnd.line,
            })) as string;
        }
        return undefined;
    }, [
        thread.threadContext,
        thread.threadContext?.filePath,
        thread.threadContext?.rightFileStart,
        thread.threadContext?.rightFileStart,
        thread.pullRequestThreadContext?.firstIterationDetails,
    ]);

    return (
        <div className={style.thread}>
            <div className={style["thread-header"]}>
                <div>
                    {filePath ? (
                        <span
                            className={`${style["file-path"]} ${style["file-path-clickable"]}`}
                            onClick={navigateToFileView}
                            title="Click to view this file in the Changes tab"
                        >
                            {filePath}
                            {lineRange && (
                                <span className={style["line-range"]}>
                                    {lineRange}
                                </span>
                            )}
                        </span>
                    ) : (
                        "General comment"
                    )}
                </div>
                <div>
                    Thread started on{" "}
                    {new Date(thread.publishedDate).toLocaleString()}
                </div>
            </div>

            {diffFileContent && (
                //  style={{ backgroundColor: "lightblue" }}
                <pre>
                    {diffFileContent
                        .split("\n")
                        .reduce((accum, line, idx, lines) => {
                            if (line.trim() !== "") {
                                // biome-ignore lint/suspicious/noArrayIndexKey: no better key available, really
                                accum.push(<DiffLine key={idx} line={line} />);
                            }
                            if (idx !== lines.length - 1) {
                                accum.push(
                                    <React.Fragment key={`${idx}c`}>
                                        {"\n"}
                                    </React.Fragment>,
                                );
                            }
                            return accum;
                        }, [] as ReactNode[])}
                </pre>
            )}

            {/* Add comments if there are any */}
            {thread.comments && thread.comments.length > 0 ? (
                thread.comments
                    .filter((comment) => !comment.isDeleted)
                    .map((comment, commentIndex) => (
                        <ThreadComment
                            key={`comment-${commentIndex}`}
                            comment={comment}
                            properties={thread.properties}
                        />
                    ))
            ) : (
                <div className={style.comment}>No comments in this thread.</div>
            )}
        </div>
    );
};

function DiffLine({ line }: { line: string }) {
    switch (line[0]) {
        case "+":
            return <span className={diffstyle.diffAdd}>{line}</span>;
        case "-":
            return <span className={diffstyle.diffRemove}>{line}</span>;
        default:
            return <span className={diffstyle.diffUnchanged}>{line}</span>;
    }
}
