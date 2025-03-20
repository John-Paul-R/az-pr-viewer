import React from 'react';

interface ErrorContainerProps {
  message: string;
  onBack: () => void;
}

export const ErrorContainer: React.FC<ErrorContainerProps> = ({ message, onBack }) => {
  return (
    <div className="error-container">
      <p className="error">{message}</p>
      <button onClick={onBack} className="back-button">Back to PR List</button>
    </div>
  );
};