// components/pr/helpers/systemMessageParser.ts
import React from "react";
import { Comment, Thread } from "../../../types/interfaces";

/**
 * Parse system messages to enhance their display
 * Currently handles vote messages
 */
export function enhanceSystemMessage(comment: Comment): React.ReactNode {
    if (!comment.content) return null;

    // Check for vote messages
    const voteRegex = /^(.+) voted (-?\d+)$/;
    const match = comment.content.match(voteRegex);

    if (match) {
        const [_, userName, voteValue] = match;
        const vote = parseInt(voteValue, 10);

        return (
            <>
                <strong>{userName}</strong> {getVoteActionText(vote)}
                <span className={`inline-vote-badge vote-${vote}`}>
                    {getVoteText(vote)}
                </span>
            </>
        );
    }

    // If no special format detected, return the original content
    return comment.content;
}

function getVoteActionText(vote: number): string {
    switch (vote) {
        case 10:
            return "approved this PR ";
        case 5:
            return "approved with suggestions ";
        case 0:
            return "reset their vote ";
        case -5:
            return "is waiting for the author ";
        case -10:
            return "rejected this PR ";
        default:
            return "voted ";
    }
}

function getVoteText(vote: number): string {
    switch (vote) {
        case 10:
            return "Approved";
        case 5:
            return "Approved with suggestions";
        case 0:
            return "No vote";
        case -5:
            return "Waiting for author";
        case -10:
            return "Rejected";
        default:
            return `Vote: ${vote}`;
    }
}

export function RenderCommits({
    commentContent,
    thread,
}: {
    commentContent: string;
    thread: Thread;
}): React.ReactNode {
    if (thread.properties?.CodeReviewRefNewCommits?.$value) {
        // real-world example value:
        // "CodeReviewRefNewCommits": {
        //   "$type": "System.String",
        //   "$value": "14325ea7a80bf75c99d5e389db4702fab28cad64;1dd92f67617807477f01c7463a77652c53a0507a;25a5830593d83cf60626b940769a2d26fec175b9;3b2a1a30c44cee4c97c101a559cf6880fc4ea078;821393ea7e5c0b506a02abb53d14a5925f666e5b;852b9826676fd0e79e5e7c581d1c962b39eb4d64;900549b78139e88455853902d6b8300382b2f868;90c60b0432a2e04d780cf868e930c95748b86fad;b00328e053e6fdb772bec457bcddd00daa87d25d;cd252e8b45873ffb5ce99794d814eeaf789629d0;d08fa83845888ec1e4e76aa2986b99b0bce40c76;db720210d8ec55982736c9d9c27d004ab6462b0c;e99704e4e325adf36050c7c9ec2771b483b29fcb;fa77afb0c2c00421ecc5fab97d724d91ca04c0cc"
        // },

        const commitsStr = thread.properties.CodeReviewRefNewCommits.$value;
        if (typeof commitsStr !== "string") {
            throw new Error("got number for commits str");
        }
        return (
            <>
                {thread.identities?.[1]?.displayName ?? <code>???</code>} pushed{" "}
                {thread.properties.CodeReviewRefNewCommitsCount?.$value ??
                    "???"}{" "}
                commit(s):
                <ul>
                    {commitsStr.split(";").map((hash) => (
                        <li>
                            <code>{hash}</code>
                        </li>
                    ))}
                </ul>
            </>
        );
    }

    return commentContent;
}
