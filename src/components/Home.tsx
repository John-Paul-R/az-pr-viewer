import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import "../App.css";
import "../FilesApp.css";
import { useAppContext } from "../AppContext";
import FileViewer from "./FileViewer";
import { PrFile, PrIndexEntry } from "../types/interfaces";

// Performance logging helper
const logPerformance = (action: string, startTime: number, extraInfo = "") => {
    const duration = performance.now() - startTime;
    console.log(
        `UI Performance: ${action} took ${duration.toFixed(2)}ms ${extraInfo}`,
    );
};

function Home() {
    const { setIndexData, archiveFile, setArchiveFile, files, setFiles } =
        useAppContext();
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");

    // Function to select tar.gz file
    async function selectArchiveFile() {
        const startTime = performance.now();
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                filters: [
                    {
                        name: "Tar GZ files",
                        extensions: ["gz", "tar.gz"],
                    },
                ],
            });

            if (selected && typeof selected === "string") {
                setArchiveFile(selected);
                logPerformance("selectArchiveFile dialog", startTime);
                await setArchiveAndFetchFiles(selected);
            } else {
                logPerformance("selectArchiveFile canceled", startTime);
            }
        } catch (err) {
            logPerformance("selectArchiveFile error", startTime);
            setError(`Failed to open archive file: ${err}`);
        }
    }

    // Function to set archive file in Rust backend and fetch files
    async function setArchiveAndFetchFiles(archivePath: string) {
        const startTime = performance.now();
        const fetchStartTime = performance.now();

        setLoading(true);
        setError("");

        try {
            // Set the archive file in the backend
            const setArchiveStartTime = performance.now();
            await invoke("set_archive_file", { newArchive: archivePath });
            logPerformance("invoke set_archive_file", setArchiveStartTime);

            // Get the index content
            const indexStartTime = performance.now();
            const indexContent = await invoke<string>("get_index_content");
            logPerformance(
                "invoke get_index_content",
                indexStartTime,
                `(${indexContent.length} bytes)`,
            );

            // Parse index
            const parseStartTime = performance.now();
            const indexEntries = JSON.parse(indexContent) as PrIndexEntry[];
            logPerformance(
                "parse index JSON",
                parseStartTime,
                `(${indexEntries.length} entries)`,
            );
            setIndexData(indexEntries);

            // Get PR files
            const filesStartTime = performance.now();
            const prFiles = await invoke<PrFile[]>("get_pr_files");
            logPerformance(
                "invoke get_pr_files",
                filesStartTime,
                `(${prFiles.length} files)`,
            );

            // Enhance PR files with title and author from index
            const enhanceStartTime = performance.now();
            const enhancedFiles = prFiles.map((file) => {
                const indexEntry = indexEntries.find(
                    (entry) => entry.id.toString() === file.pr_number,
                );

                return {
                    ...file,
                    title: indexEntry ? indexEntry.title : "Unknown Title",
                    author: indexEntry
                        ? indexEntry.created_by
                        : "Unknown Author",
                    status: indexEntry ? indexEntry.status : "unknown",
                    creation_date: indexEntry ? indexEntry.creation_date : "",
                    repository: indexEntry ? indexEntry.repository : "",
                    source_branch: indexEntry ? indexEntry.source_branch : "",
                    target_branch: indexEntry ? indexEntry.target_branch : "",
                };
            });
            logPerformance("enhance files with metadata", enhanceStartTime);

            setFiles(enhancedFiles);
            logPerformance("total data fetching", fetchStartTime);
        } catch (err) {
            setError(`Error: ${err}`);
            setFiles([]);
            setIndexData([]);
        } finally {
            setLoading(false);
            logPerformance("setArchiveAndFetchFiles total", startTime);
        }
    }

    // Filter files based on search term
    const filterFiles = () => {
        if (searchTerm === "") return files;

        const startTime = performance.now();
        const result = files.filter(
            (file) =>
                file.pr_number.includes(searchTerm) ||
                file.filename
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                file.author?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
        logPerformance(
            "filter files",
            startTime,
            `(${result.length}/${files.length} files)`,
        );
        return result;
    };

    const filteredFiles = filterFiles();

    return (
        <div className="center-container">
            <h1>PR JSON Viewer</h1>

            <div className="directory-section">
                <button type="button" onClick={selectArchiveFile}>
                    Select PR Archive File
                </button>
                <p className="selected-dir">
                    {archiveFile || "No archive file selected"}
                </p>
            </div>

            {error && <div className="error">{error}</div>}

            {archiveFile && (
                <div className="search-section">
                    <input
                        type="text"
                        placeholder="Search PRs by number, title, or author..."
                        value={searchTerm}
                        onChange={(e) => {
                            const startTime = performance.now();
                            setSearchTerm(e.target.value);
                            logPerformance("searchTerm update", startTime);
                        }}
                    />
                </div>
            )}

            {loading ? (
                <p>Loading PRs...</p>
            ) : (
                <FileViewer files={filteredFiles} />
            )}
        </div>
    );
}

export default Home;
