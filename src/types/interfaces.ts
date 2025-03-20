export interface PrFile {
    filename: string;
    path: string;
    pr_number: string;
    num: number;
    // Added fields from index data
    title?: string;
    author?: string;
    status?: string;
    creation_date?: string;
    repository?: string;
    source_branch?: string;
    target_branch?: string;
}

export interface PrIndexEntry {
    id: number;
    title: string;
    created_by: string;
    creation_date: string;
    status: string;
    repository: string;
    source_branch: string;
    target_branch: string;
    filename: string;
}

// Common simple types
export type Href = { href: string };
export type UserIdentity = {
    displayName: string;
    url: string;
    _links: { avatar: Href };
    id: string;
    uniqueName: string;
    imageUrl: string;
    descriptor: string;
    isContainer?: boolean;
};

// PR Data type
export interface PrData {
    id: number;
    title: string;
    description?: string;
    created_by: string;
    created_by_id?: string;
    creation_date: string;
    status: string;
    repository: string;
    repository_id?: string;
    source_branch: string;
    target_branch: string;
    url?: string;
    completion_date?: string;
    auto_complete_set_by?: string | null;
    merge_status?: string;
    merge_id?: string;
    last_merge_source_commit?: string;
    last_merge_target_commit?: string;
    last_merge_commit?: string;
    is_draft?: boolean;
    has_conflicts?: boolean;
    supportsIterations?: boolean;
    work_item_refs?: any[];
    completion_options?: {
        mergeCommitMessage?: string;
        squashMerge?: boolean;
        mergeStrategy?: string;
        bypassReason?: string;
    };
    completion_queue_time?: string;
    reviewers?: {
        id: string;
        displayName: string;
        vote: number;
        isRequired: boolean;
    }[];
    threads?: Thread[];
}

export interface Thread {
    pullRequestThreadContext?: {
        iterationContext: {
            firstComparingIteration: number;
            secondComparingIteration: number;
        };
        changeTrackingId: number;
    };
    id: number;
    publishedDate: string;
    lastUpdatedDate: string;
    comments?: Comment[];
    threadContext?: {
        filePath: string;
        rightFileStart?: FilePosition;
        rightFileEnd?: FilePosition;
    };
    properties: ThreadProperties;
    identities?: {
        1: UserIdentity;
        2?: UserIdentity;
    };
    isDeleted: boolean;
    _links: {
        self: Href;
        repository: Href;
    };
    status?: string;
}

export interface Comment {
    id: number;
    parentCommentId: number;
    author: UserIdentity;
    content?: string;
    publishedDate: string;
    lastUpdatedDate: string;
    lastContentUpdatedDate: string;
    commentType: string;
    usersLiked?: UserIdentity[];
    _links: {
        self: Href;
        repository: Href;
        threads: Href;
        pullRequests: Href;
    };
    isDeleted?: boolean;
}

export interface FilePosition {
    line: number;
    offset: number;
}

// Property type for various code review properties
export type PropertyValue = {
    $type: string;
    $value: string | number;
};

// Thread properties without the long names
export interface ThreadProperties {
    // String properties
    CodeReviewThreadType?: PropertyValue;
    CodeReviewPolicyType?: PropertyValue;
    CodeReviewRequiredReviewerExamplePathThatTriggered?: PropertyValue;
    CodeReviewRequiredReviewerIsRequired?: PropertyValue;
    CodeReviewRequiredReviewerUserConfiguredMessage?: PropertyValue;
    CodeReviewRequiredReviewerExampleReviewerIdentities?: PropertyValue;
    "Microsoft.TeamFoundation.Discussion.UniqueID"?: PropertyValue;
    CodeReviewRefName?: PropertyValue;
    CodeReviewRefNewCommits?: PropertyValue;
    CodeReviewRefNewHeadCommit?: PropertyValue;
    CodeReviewRefUpdatedByIdentity?: PropertyValue;
    CodeReviewReviewersUpdatedAddedIdentity?: PropertyValue;
    CodeReviewReviewersUpdatedByIdentity?: PropertyValue;
    CodeReviewVoteResult?: PropertyValue;
    CodeReviewVotedByInitiatorIdentity?: PropertyValue;
    CodeReviewVotedByIdentity?: PropertyValue;
    CodeReviewTargetChangedByDisplayName?: PropertyValue;
    CodeReviewTargetChangedByTfId?: PropertyValue;
    BypassPolicy?: PropertyValue;
    CodeReviewStatus?: PropertyValue;
    CodeReviewStatusUpdateAssociatedCommit?: PropertyValue;
    CodeReviewStatusUpdatedByIdentity?: PropertyValue;

    // Number properties
    CodeReviewRequiredReviewerNumFilesThatTriggered?: PropertyValue;
    CodeReviewRequiredReviewerNumReviewers?: PropertyValue;
    "Microsoft.TeamFoundation.Discussion.SupportsMarkdown"?: PropertyValue;
    CodeReviewRefNewCommitsCount?: PropertyValue;
    CodeReviewReviewersUpdatedNumAdded?: PropertyValue;
    CodeReviewReviewersUpdatedNumRemoved?: PropertyValue;
    CodeReviewReviewersUpdatedNumChanged?: PropertyValue;
    CodeReviewReviewersUpdatedNumDeclined?: PropertyValue;
}
