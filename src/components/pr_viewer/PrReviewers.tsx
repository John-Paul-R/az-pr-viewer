// components/pr/PrReviewers.tsx
import React from 'react';

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
    <div className="pr-reviewers-section">
      <h4 className="reviewers-title">Reviewers</h4>
      <div className="reviewers-container">
        {reviewers.map(reviewer => (
          <div key={reviewer.id} className="reviewer-card">
            <div className="reviewer-info">
              {reviewer.imageUrl && (
                <div className="reviewer-avatar">
                  <img
                    src={reviewer.imageUrl}
                    alt={`${reviewer.displayName}'s avatar`}
                    className="avatar-image"
                  />
                </div>
              )}
              <div className="reviewer-name" title={reviewer.displayName}>
                {reviewer.displayName}
              </div>
            </div>
            <div className="reviewer-status">
              <span className={`vote-badge vote-${reviewer.vote}`}>
                {getVoteText(reviewer.vote)}
              </span>
              {reviewer.isRequired && <span className="required-badge">Required</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};