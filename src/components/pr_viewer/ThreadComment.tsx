import React from "react";
import { Comment, ThreadProperties } from "../../types/interfaces";
import { Markdown } from "../Markdown";
import style from "../PrViewer.module.css" with { type: "css" };

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

    // Get the list of users who liked the comment
    const hasLikes = comment.usersLiked && comment.usersLiked.length > 0;
    const likesCount = hasLikes ? comment.usersLiked!.length : 0;

    // Create the tooltip text with the names of users who liked
    const likedByTooltip = hasLikes
        ? comment.usersLiked!.map((user) => user.displayName).join("\n")
        : "";

    return (
        <div className={style.comment}>
            <div className={style["comment-header"]}>
                <div className={style["comment-author"]}>
                    {comment.author && comment.author.displayName
                        ? comment.author.displayName
                        : "Unknown"}
                </div>
                <div className={style["comment-metadata"]}>
                    {hasLikes && (
                        <div
                            className={style["likes-indicator"]}
                            title={likedByTooltip}
                        >
                            Liked {likesCount}
                        </div>
                    )}
                    <div className={style["comment-date"]}>
                        {new Date(comment.publishedDate).toLocaleString()}
                    </div>
                </div>
            </div>
            <div className={style["comment-content"]}>
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
