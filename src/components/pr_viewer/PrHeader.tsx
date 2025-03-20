import React from 'react';

interface PrHeaderProps {
  title: string;
  status?: string;
  url?: string;
}

export const PrHeader: React.FC<PrHeaderProps> = ({ title, status, url }) => {
  // Determine status class for styling
  const getStatusClass = (status: string | undefined): string => {
    if (!status) return "";
    if (status.toLowerCase() === "active") return "status-active";
    if (status.toLowerCase() === "completed") return "status-completed";
    if (status.toLowerCase() === "abandoned") return "status-abandoned";
    return "";
  };

  return (
    <div className="pr-header">
      <div>
        <h3 className="pr-title">{title}</h3>
        <div>
          {status && (
            <span className={`status-badge ${getStatusClass(status)}`}>
              {status}
            </span>
          )}
        </div>
      </div>
      {url && (
        <div className="external-link">
          <a href={url} target="_blank" rel="noopener noreferrer">
            View in Browser
          </a>
        </div>
      )}
    </div>
  );
};