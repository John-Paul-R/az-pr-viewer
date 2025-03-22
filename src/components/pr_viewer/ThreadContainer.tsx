import React from "react";
import { Thread } from "../../types/interfaces";
import { ThreadComment } from "./ThreadComment";
import style from "../PrViewer.module.css" with { type: "css" };

interface ThreadContainerProps {
    thread: Thread;
}

export const ThreadContainer: React.FC<ThreadContainerProps> = ({ thread }) => {
    let filePath = "";
    let lineRange = "";

    if (thread.threadContext && thread.threadContext.filePath) {
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
