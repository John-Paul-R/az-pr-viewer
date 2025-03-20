import { Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { PrFile } from "../types/interfaces";
import "./FileViewer.css";

interface FileViewerProps {
    files: PrFile[];
}

function FileViewer({ files }: FileViewerProps) {
    const navigate = useNavigate();

    async function handleFileClick(file: PrFile) {
        try {
            // Read the file content
            const content = await invoke<string>("read_pr_file", {
                path: file.path,
            });

            // Store content in localStorage to pass to detail page
            localStorage.setItem("currentPrData", content);

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
        <div className="file-list">
            <h2>PR Files ({files.length})</h2>
            <div className="file-grid">
                <div className="file-header">
                    <div className="file-cell">PR #</div>
                    <div className="file-cell file-title">Title</div>
                    <div className="file-cell">Author</div>
                    <div className="file-cell">Status</div>
                    <div className="file-cell">Date</div>
                </div>
                {files.map((file) => (
                    <Link
                        to={`/pr/${file.pr_number}`}
                        key={file.path}
                        className="file-row"
                        data-status={file.status || "unknown"}
                        onClick={() => handleFileClick(file)}
                    >
                        <div className="file-cell">{file.pr_number}</div>
                        <div className="file-cell file-title">
                            {file.title || "Unknown Title"}
                        </div>
                        <div className="file-cell">
                            {file.author || "Unknown Author"}
                        </div>
                        <div className="file-cell status-cell">
                            <span
                                className={`status-badge status-${
                                    file.status || "unknown"
                                }`}
                            >
                                {file.status || "unknown"}
                            </span>
                        </div>
                        <div className="file-cell">
                            {file.creation_date
                                ? new Date(
                                      file.creation_date,
                                  ).toLocaleDateString()
                                : "Unknown"}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default FileViewer;
