import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import ReactMarkdown from "react-markdown";
import { Comment, Thread } from "../../types/interfaces";
import {
    enhanceSystemMessage,
    RenderCommits,
} from "./helpers/systemMessageParser";

interface SystemNotificationProps {
    comment: Comment;
    thread: Thread;
}

export const SystemNotification: React.FC<SystemNotificationProps> = ({
    comment,
    thread,
}) => {
    // Check if it's a vote message that we should enhance
    const isVoteMessage = comment.content?.match(/^(.+) voted (-?\d+)$/);
    const isRefUpdateMessage = comment.content?.match(
        /^The reference .+ was updated.$/,
    );

    return (
        <ErrorBoundary
            fallbackRender={() => (
                <div className="pr-details error">
                    <p>
                        An unexpected error occurred while rendering System
                        Notification
                    </p>
                </div>
            )}
        >
            <div className="system-notification">
                <div className="notification-time">
                    {new Date(comment.publishedDate).toLocaleString()}
                </div>
                <div className="notification-content">
                    {comment.content &&
                        (isVoteMessage ? (
                            enhanceSystemMessage(comment)
                        ) : isRefUpdateMessage ? (
                            <RenderCommits
                                commentContent={comment.content}
                                thread={thread}
                            />
                        ) : (
                            <ReactMarkdown>{comment.content}</ReactMarkdown>
                        ))}
                </div>
            </div>
        </ErrorBoundary>
    );
};
