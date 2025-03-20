import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface PrDescriptionProps {
  description?: string;
}

export const PrDescription: React.FC<PrDescriptionProps> = ({ description }) => {
  if (!description) return null;

  return (
    <div className="pr-description">
      <h4 className="description-title">Description</h4>
      <div className="description-content">
        <ReactMarkdown rehypePlugins={[rehypeSanitize, rehypeRaw]}>
          {description}
        </ReactMarkdown>
      </div>
    </div>
  );
};