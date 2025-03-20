import React from "react";
import ReactMarkdown from "react-markdown";
import { Comment } from "../../types/interfaces";
import { enhanceSystemMessage } from "./helpers/systemMessageParser";

interface SystemNotificationProps {
    comment: Comment;
}

export const SystemNotification: React.FC<SystemNotificationProps> = ({
    comment,
}) => {
    // Check if it's a vote message that we should enhance
    const isVoteMessage = comment.content?.match(/^(.+) voted (-?\d+)$/);

    return (
        <div className="system-notification">
            <div className="notification-time">
                {new Date(comment.publishedDate).toLocaleString()}
            </div>
            <div className="notification-content">
                {comment.content &&
                    (isVoteMessage ? (
                        enhanceSystemMessage(comment)
                    ) : (
                        <ReactMarkdown>{comment.content}</ReactMarkdown>
                    ))}
            </div>
        </div>
    );
};
