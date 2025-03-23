import React, { useEffect, useState } from "react";
import { Thread } from "../../types/interfaces";
import { ThreadComment } from "./ThreadComment";
import style from "../PrViewer.module.css" with { type: "css" };
import { invoke } from "@tauri-apps/api/core";

interface ThreadContainerProps {
    thread: Thread;
}

export const ThreadContainer: React.FC<ThreadContainerProps> = ({ thread }) => {
    let filePath = "";
    let lineRange = "";
    const [beforeFileLines, setBeforeFileLines] = useState<string[]>();
    const [afterFileLines, setAfterFileLines] = useState<string[]>();

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

    useEffect(() => {
        if (
            thread.threadContext?.filePath &&
            thread.threadContext.rightFileStart &&
            thread.threadContext.rightFileEnd &&
            thread.pullRequestThreadContext?.firstIterationDetails
        ) {
            invoke("get_git_file_lines_at_revision", {
                // git2 wants relative paths, and all these state with `/` -- it
                // also doesn't want the value to start with '.'
                filePath: thread.threadContext.filePath.slice(1),
                revision:
                    thread.pullRequestThreadContext.firstIterationDetails
                        ?.sourceCommit,
                startLine: thread.threadContext.rightFileStart.line,
                endLine: thread.threadContext.rightFileEnd.line,
            }).then((res) => setBeforeFileLines(res as string[]));

            invoke("get_git_file_lines_at_revision", {
                // git2 wants relative paths, and all these state with `/` -- it
                // also doesn't want the value to start with '.'
                filePath: thread.threadContext.filePath.slice(1),
                revision:
                    thread.pullRequestThreadContext?.firstIterationDetails
                        .targetCommit,
                startLine: thread.threadContext.rightFileStart.line,
                endLine: thread.threadContext.rightFileEnd.line,
            }).then((res) => setAfterFileLines(res as string[]));
        }
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
                        <span className={style["file-path"]}>
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
            {beforeFileLines && (
                <pre style={{ backgroundColor: "lightgreen" }}>
                    {beforeFileLines.map((line) => line).join("\n")}
                </pre>
            )}

            {afterFileLines && (
                <pre style={{ backgroundColor: "pink" }}>
                    {afterFileLines.map((line) => line).join("\n")}
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
