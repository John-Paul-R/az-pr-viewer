import { Thread } from "../../../types/interfaces";

/**
 * Find all vote events in threads and extract relevant information
 */
export function parseVoteEvents(threads: Thread[] = []) {
    const voteEvents: {
        userId: string;
        userName: string;
        vote: number;
        date: string;
        imageUrl?: string;
    }[] = [];

    // Filter for vote update threads
    const voteThreads = threads.filter(
        (thread) =>
            thread.properties?.CodeReviewThreadType &&
            thread.properties.CodeReviewThreadType.$value === "VoteUpdate",
    );

    // Process each vote thread
    for (const thread of voteThreads) {
        // Get vote value
        const voteValue = thread.properties.CodeReviewVoteResult?.$value;
        if (!voteValue) continue;

        // Get voter identity ID
        const voterIdentityId =
            thread.properties.CodeReviewVotedByIdentity?.$value;
        if (!voterIdentityId || !thread.identities?.[voterIdentityId]) {
            continue;
        }

        // Get voter info
        const voter = thread.identities[voterIdentityId];
        const date = thread.publishedDate;

        voteEvents.push({
            userId: voter.id,
            userName: voter.displayName,
            vote: parseInt(voteValue, 10),
            date,
            imageUrl: voter.imageUrl || voter._links?.avatar?.href,
        });
    }

    // Sort by date (newest first)
    voteEvents.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Create a map of the most recent vote for each user
    const latestVotes = new Map();
    for (const event of voteEvents) {
        if (!latestVotes.has(event.userId)) {
            latestVotes.set(event.userId, event);
        }
    }

    return Array.from(latestVotes.values());
}

/**
 * Update reviewers with avatar info from vote threads
 */
export function enrichReviewersWithAvatars(
    reviewers: {
        id: string;
        displayName: string;
        vote: number;
        isRequired: boolean;
        imageUrl?: string;
    }[] = [],
    threads: Thread[] = [],
) {
    if (
        !reviewers ||
        reviewers.length === 0 ||
        !threads ||
        threads.length === 0
    ) {
        return reviewers;
    }

    // Parse vote events to get avatars
    const voteEvents = parseVoteEvents(threads);

    // Create a map of user IDs to vote events
    const userVoteMap = new Map();
    for (const event of voteEvents) {
        userVoteMap.set(event.userId, event);
    }

    // Update reviewers with avatar URLs
    return reviewers.map((reviewer) => {
        const voteEvent = userVoteMap.get(reviewer.id);

        if (voteEvent && voteEvent.imageUrl && !reviewer.imageUrl) {
            return {
                ...reviewer,
                imageUrl: voteEvent.imageUrl,
            };
        }

        return reviewer;
    });
}
