import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Comment } from '../../types/interfaces';

interface SystemNotificationProps {
  comment: Comment;
}

export const SystemNotification: React.FC<SystemNotificationProps> = ({ comment }) => {
  return (
    <div className="system-notification">
      <div className="notification-time">
        {new Date(comment.publishedDate).toLocaleString()}
      </div>
      <div className="notification-content">
        {comment.content && (
          <ReactMarkdown>{comment.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
};