import React from 'react';

interface PrMetadataProps {
  createdBy?: string;
  creationDate?: string;
  completionDate?: string;
  repository?: string;
  sourceBranch?: string;
  targetBranch?: string;
}

export const PrMetadata: React.FC<PrMetadataProps> = ({
  createdBy,
  creationDate,
  completionDate,
  repository,
  sourceBranch,
  targetBranch
}) => {
  // Format dates
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "Not available";
    return new Date(dateStr).toLocaleString();
  };

  // Format branch name (remove refs/heads/)
  const formatBranchName = (branchRef: string | undefined): string => {
    if (!branchRef) return "Unknown";
    return branchRef.replace('refs/heads/', '');
  };

  return (
    <div className="pr-metadata">
      <div className="metadata-item">
        <span className="metadata-label">Created By</span>
        <span className="metadata-value">{createdBy || "Unknown"}</span>
      </div>
      <div className="metadata-item">
        <span className="metadata-label">Creation Date</span>
        <span className="metadata-value">
          {formatDate(creationDate)}
        </span>
      </div>
      <div className="metadata-item">
        <span className="metadata-label">Completion Date</span>
        <span className="metadata-value">
          {completionDate ? formatDate(completionDate) : "Not completed"}
        </span>
      </div>
      <div className="metadata-item">
        <span className="metadata-label">Repository</span>
        <span className="metadata-value">{repository || "Unknown"}</span>
      </div>
      <div className="metadata-item">
        <span className="metadata-label">Source Branch</span>
        <span className="metadata-value">{formatBranchName(sourceBranch)}</span>
      </div>
      <div className="metadata-item">
        <span className="metadata-label">Target Branch</span>
        <span className="metadata-value">{formatBranchName(targetBranch)}</span>
      </div>
    </div>
  );
};