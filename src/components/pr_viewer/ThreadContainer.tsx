import React from 'react';
import { Thread } from '../../types/interfaces';
import { ThreadComment } from './ThreadComment';

interface ThreadContainerProps {
  thread: Thread;
}

export const ThreadContainer: React.FC<ThreadContainerProps> = ({ thread }) => {
  let filePath = "";
  if (thread.threadContext && thread.threadContext.filePath) {
    filePath = thread.threadContext.filePath;
  }

  return (
    <div className="thread">
      <div className="thread-header">
        <div>
          {filePath ? (
            <span className="file-path">
              {filePath}
            </span>
          ) : (
            "General comment"
          )}
        </div>
        <div>
          Thread started on{" "}
          {new Date(thread.publishedDate).toLocaleString()}
        </div>
      </div>

      {/* Add comments if there are any */}
      {thread.comments && thread.comments.length > 0 ? (
        thread.comments
          .filter((comment) => !comment.isDeleted)
          .map((comment, commentIndex) => (
            <ThreadComment
              key={`comment-${commentIndex}`}
              comment={comment}
              properties={thread.properties}
            />
          ))
      ) : (
        <div className="comment">No comments in this thread.</div>
      )}
    </div>
  );
};