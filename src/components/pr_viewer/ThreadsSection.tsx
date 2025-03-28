import type React from "react";
import { useState } from "react";
import type { Thread } from "../../types/interfaces";
import { SystemNotification } from "./SystemNotification";
import { ThreadContainer } from "./ThreadContainer";
import { ThreadFilter } from "./ThreadFilter";
import style from "../PrViewer.module.css" with { type: "css" };

interface ThreadsSectionProps {
    threads: Thread[];
}

export const ThreadsSection: React.FC<ThreadsSectionProps> = ({ threads }) => {
    const [filterType, setFilterType] = useState<"all" | "comments">("all");
    const activeThreads = threads.filter((thread) => !thread.isDeleted);

    if (activeThreads.length === 0) {
        return (
            <div className={style["threads-section"]}>
                <h3>Activity</h3>
                <p>No activity on this pull request.</p>
            </div>
        );
    }

    // Filter threads based on selected filter type
    const filteredThreads =
        filterType === "all"
            ? activeThreads
            : activeThreads.filter(
                  (thread) =>
                      thread.comments &&
                      thread.comments.length > 0 &&
                      thread.comments.some(
                          (comment) => comment.commentType === "text",
                      ),
              );

    // Sort threads by reverse publishedDate
    const sortedThreads = [...filteredThreads].sort(
        (a, b) =>
            new Date(b.publishedDate).getTime() -
            new Date(a.publishedDate).getTime(),
    );

    return (
        <div className={style["threads-section"]}>
            <h3>
                Activity ({filteredThreads.length} items)
                <ThreadFilter
                    currentFilter={filterType}
                    onFilterChange={setFilterType}
                />
            </h3>

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
