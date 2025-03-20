import React from 'react';

interface PrBranchesProps {
  sourceBranch?: string;
  targetBranch?: string;
}

export const PrBranches: React.FC<PrBranchesProps> = ({ sourceBranch, targetBranch }) => {
  // Format branch name (remove refs/heads/)
  const formatBranchName = (branchRef: string | undefined): string => {
    if (!branchRef) return "Unknown";
    return branchRef.replace('refs/heads/', '');
  };

  return (
    <div className="pr-branches">
      <div className="branch source">
        <span className="label">Source:</span>
        <span className="branch-name">{formatBranchName(sourceBranch)}</span>
      </div>
      <div className="branch-arrow">→</div>
      <div className="branch target">
        <span className="label">Target:</span>
        <span className="branch-name">{formatBranchName(targetBranch)}</span>
      </div>
    </div>
  );
};