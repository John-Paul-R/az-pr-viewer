// components/pr/helpers/systemMessageParser.ts
import React from 'react';
import { Comment } from '../../../types/interfaces';

/**
 * Parse system messages to enhance their display
 * Currently handles vote messages
 */
export function enhanceSystemMessage(comment: Comment): React.ReactNode {
  if (!comment.content) return null;

  // Check for vote messages
  const voteRegex = /^(.+) voted (-?\d+)$/;
  const match = comment.content.match(voteRegex);

  if (match) {
    const [_, userName, voteValue] = match;
    const vote = parseInt(voteValue, 10);

    return (
      <>
        <strong>{userName}</strong> {getVoteActionText(vote)}
        <span className={`inline-vote-badge vote-${vote}`}>
          {getVoteText(vote)}
        </span>
      </>
    );
  }

  // If no special format detected, return the original content
  return comment.content;
}

function getVoteActionText(vote: number): string {
  switch (vote) {
    case 10:
      return "approved this PR ";
    case 5:
      return "approved with suggestions ";
    case 0:
      return "reset their vote ";
    case -5:
      return "is waiting for the author ";
    case -10:
      return "rejected this PR ";
    default:
      return "voted ";
  }
}

function getVoteText(vote: number): string {
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
}