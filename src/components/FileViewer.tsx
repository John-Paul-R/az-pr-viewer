import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { PrFile } from '../types/interfaces';

interface FileViewerProps {
  files: PrFile[];
}

function FileViewer({ files }: FileViewerProps) {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<PrFile | null>(null);

  async function handleFileClick(file: PrFile) {
    setSelectedFile(file);

    try {
      // Read the file content
      const content = await invoke<string>('read_pr_file', { path: file.path });

      // Store content in localStorage to pass to detail page
      localStorage.setItem('currentPrData', content);

      // Navigate to detail page
      navigate(`/pr/${file.pr_number}`);
    } catch (err) {
      console.error("Failed to read PR file:", err);
      alert(`Error reading file: ${err}`);
    }
  }

  if (files.length === 0) {
    return <p>No PR files found in the selected directory.</p>;
  }

  return (
    <div className="file-viewer">
      <h2>PR Files</h2>
      <div className="file-list">
        {files.map((file, index) => (
          <div
            key={index}
            className={`file-item ${selectedFile === file ? 'selected' : ''}`}
            onClick={() => handleFileClick(file)}
          >
            <span className="pr-number">PR #{file.pr_number}</span>
            <span className="filename">{file.filename}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FileViewer;
