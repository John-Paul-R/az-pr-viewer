import React from "react";
import { Thread } from "../../types/interfaces";
import { SystemNotification } from "./SystemNotification";
import { ThreadContainer } from "./ThreadContainer";
import style from "../PrViewer.module.css" with { type: "css" };

interface ThreadsSectionProps {
    threads: Thread[];
}

export const ThreadsSection: React.FC<ThreadsSectionProps> = ({ threads }) => {
    const activeThreads = threads.filter((thread) => !thread.isDeleted);

    if (activeThreads.length === 0) {
        return (
            <div className={style["threads-section"]}>
                <h3>Activity</h3>
                <p>No activity on this pull request.</p>
            </div>
        );
    }

    // Sort threads by reverse publishedDate
    const sortedThreads = [...activeThreads].sort(
        (a, b) =>
            new Date(b.publishedDate).getTime() -
            new Date(a.publishedDate).getTime(),
    );
    console.log(sortedThreads);

    return (
        <div className={style["threads-section"]}>
            <h3>Activity ({activeThreads.length} items)</h3>

            {sortedThreads.map((thread, threadIndex) => {
                // Check if this is a system notification thread
                const isSystemThread =
                    thread.comments &&
                    thread.comments.length === 1 &&
                    thread.comments[0] &&
                    (thread.comments[0].commentType === "system" ||
                        (thread.comments[0].author &&
                            thread.comments[0].author.displayName &&
                            thread.comments[0].author.displayName.includes(
                                "Microsoft.VisualStudio.Services.TFS",
                            )));

                if (
                    isSystemThread &&
                    thread.comments &&
                    thread.comments.length > 0
                ) {
                    // Render as a system notification
                    return (
                        <SystemNotification
                            key={`thread-${threadIndex}`}
                            comment={thread.comments[0]}
                            thread={thread}
                        />
                    );
                }

                // Render as a regular comment thread
                return (
                    <ThreadContainer
                        key={`thread-${threadIndex}`}
                        thread={thread}
                    />
                );
            })}
        </div>
    );
};
