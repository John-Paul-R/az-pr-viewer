import { Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { PrFile } from "../types/interfaces";
import "./FileViewer.css";

type FuseResultMatch = {
    refIndex?: number;
    value?: string;
};

interface FileViewerProps {
    files: { item: PrFile; refIndex?: number; matches?: FuseResultMatch[] }[];
}

function FileViewer({ files }: FileViewerProps) {
    const navigate = useNavigate();

    async function handleFileClick(file: PrFile) {
        try {
            // Navigate to detail page
            navigate(`/pr/${file.pr_number}`);

            // Read the file content
            const content = await invoke<string>("read_pr_file", {
                path: file.archive_path,
            });

            // Store content in localStorage to pass to detail page
            localStorage.setItem("currentPrData", content);
        } catch (err) {
            console.error("Failed to read PR file:", err);
            alert(`Error reading file: ${err}`);
        }
    }

    if (files.length === 0) {
        return <p>No PR files found in the selected directory.</p>;
    }

    const highlight = (
        text: string | undefined,
        match: FuseResultMatch | undefined,
    ) => {
        if (text === undefined) {
            return undefined;
        }
        if (match?.refIndex !== undefined && match.value) {
            const end = match.refIndex + match.value.length;
            return (
                <>
                    {text.slice(0, match.refIndex)}
                    <strong>
                        {text.slice(match.refIndex, match.value.length)}
                    </strong>
                    {text.slice(end)}
                </>
            );
        }
        return text;
    };

    return (
        <div className="file-list">
            <div className="file-grid">
                <div className="file-header">
                    <div className="file-cell">PR #</div>
                    <div className="file-cell file-title">Title</div>
                    <div className="file-cell">Author</div>
                    <div className="file-cell">Status</div>
                    <div className="file-cell">Date</div>
                </div>
                {files.slice(0, 100).map(({ item: file }) => {
                    const matchByKey = new Map();
                    return (
                        <Link
                            to={`/pr/${file.pr_number}`}
                            key={file.archive_path}
                            className="file-row"
                            data-status={file.status || "unknown"}
                            onClick={() => handleFileClick(file)}
                        >
                            <div className="file-cell">
                                {highlight(
                                    file.pr_number.toString(),
                                    matchByKey.get("pr_number"),
                                )}
                            </div>
                            <div className="file-cell file-title">
                                {highlight(
                                    file.title,
                                    matchByKey.get("title"),
                                ) || "Unknown Title"}
                            </div>
                            <div className="file-cell">
                                {highlight(
                                    file.author,
                                    matchByKey.get("author"),
                                ) || "Unknown Author"}
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
                    );
                })}
            </div>
        </div>
    );
}

export default FileViewer;
