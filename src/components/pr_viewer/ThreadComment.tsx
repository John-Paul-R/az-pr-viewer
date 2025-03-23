import type React from "react";
import type {
    Comment,
    ThreadProperties,
    UserIdentity,
} from "../../types/interfaces";
import { Markdown } from "../Markdown";
import style from "../PrViewer.module.css" with { type: "css" };

interface ThreadCommentProps {
    comment: Comment;
    properties?: ThreadProperties;
}

// Helper function to get initials from a name
const getInitials = (name: string): string => {
    const parts = name.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
        parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
};

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
                        <div className={style["likes-container"]}>
                            <div className={style["likes-initials-container"]}>
                                {comment.usersLiked!.map(
                                    (user: UserIdentity, index: number) => (
                                        <div
                                            key={user.id || index}
                                            className={style["initial-circle"]}
                                            style={
                                                {
                                                    zIndex: index + 1, // Reversed stacking order
                                                    right: `${index * 8}px`,
                                                    "--hover-offset": index, // CSS variable for hover position
                                                } as React.CSSProperties
                                            }
                                            title={user.displayName}
                                        >
                                            {getInitials(user.displayName)}
                                        </div>
                                    ),
                                )}
                            </div>
                            <div
                                className={style["likes-indicator"]}
                                title={likedByTooltip}
                            >
                                Liked {likesCount}
                            </div>
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
