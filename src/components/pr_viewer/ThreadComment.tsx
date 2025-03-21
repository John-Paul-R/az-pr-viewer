import React from "react";
import { Comment, ThreadProperties } from "../../types/interfaces";
import { Markdown } from "../Markdown";

interface ThreadCommentProps {
    comment: Comment;
    properties?: ThreadProperties;
}

export const ThreadComment: React.FC<ThreadCommentProps> = ({
    comment,
    properties,
}) => {
    // Check if markdown is supported for this comment thread
    const supportsMarkdown =
        properties &&
        properties["Microsoft.TeamFoundation.Discussion.SupportsMarkdown"] &&
        properties["Microsoft.TeamFoundation.Discussion.SupportsMarkdown"]
            .$value === 1;

    return (
        <div className="comment">
            <div className="comment-header">
                <div className="comment-author">
                    {comment.author && comment.author.displayName
                        ? comment.author.displayName
                        : "Unknown"}
                </div>
                <div className="comment-date">
                    {new Date(comment.publishedDate).toLocaleString()}
                </div>
            </div>
            <div className="comment-content">
                {comment.content &&
                    (supportsMarkdown ? (
                        <Markdown markdown={comment.content} />
                    ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>
                            {comment.content}
                        </div>
                    ))}
            </div>
        </div>
    );
};
