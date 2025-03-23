// components/pr/PrReviewers.tsx
import type React from "react";
import style from "../PrViewer.module.css" with { type: "css" };
import badgestyle from "../badges.module.css" with { type: "css" };

interface Reviewer {
    id: string;
    displayName: string;
    vote: number;
    isRequired: boolean;
    imageUrl?: string;
}

interface PrReviewersProps {
    reviewers?: Reviewer[];
}

export const PrReviewers: React.FC<PrReviewersProps> = ({ reviewers }) => {
    if (!reviewers || reviewers.length === 0) return null;

    // Get readable text for vote values
    const getVoteText = (vote: number): string => {
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
    };

    return (
        <div className={style["pr-reviewers-section"]}>
            <h4 className={style["reviewers-title"]}>Reviewers</h4>
            <div className={style["reviewers-container"]}>
                {reviewers.map((reviewer) => (
                    <div key={reviewer.id} className={style["reviewer-card"]}>
                        <div className={style["reviewer-info"]}>
                            {/* {reviewer.imageUrl && (
                <div className={style["reviewer-avatar"]}>
                  <img
                    src={reviewer.imageUrl}
                    alt={`${reviewer.displayName}'s avatar`}
                    className={style["avatar-image"]}
                  />
                </div>
              )} */}
                            <div
                                className={style["reviewer-name"]}
                                title={reviewer.displayName}
                            >
                                {reviewer.displayName}
                            </div>
                        </div>
                        <div className={style["reviewer-status"]}>
                            <span
                                className={`${badgestyle["vote-badge"]} ${
                                    badgestyle[`vote-${reviewer.vote}`]
                                }`}
                            >
                                {getVoteText(reviewer.vote)}
                            </span>
                            {reviewer.isRequired && (
                                <span className={style["required-badge"]}>
                                    Required
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
