import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import "../App.css";
import "../FilesApp.css";
import { useAppContext } from "../AppContext";
import FileViewer from "./FileViewer";
import { PrFile } from "../types/interfaces";

// Performance logging helper
const logPerformance = (action: string, startTime: number, extraInfo = "") => {
    const duration = performance.now() - startTime;
    console.log(
        `UI Performance: ${action} took ${duration.toFixed(2)}ms ${extraInfo}`,
    );
};

function Home() {
    const {
        archiveFile,
        setArchiveFile,
        files,
        setFiles,
        repoPath,
        setRepoPath,
    } = useAppContext();
    const [loading, setLoading] = useState<boolean>(false);
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchResults, setSearchResults] = useState<PrFile[] | null>(null);

    // Function to select tar.gz file
    async function selectArchiveFile() {
        const startTime = performance.now();
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                filters: [
                    {
                        name: "ZIP files",
                        extensions: ["zip"],
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
        setSearchResults(null);

        try {
            // Set the archive file in the backend
            const setArchiveStartTime = performance.now();
            await invoke("set_archive_file", { newArchive: archivePath });
            logPerformance("invoke set_archive_file", setArchiveStartTime);

            // Get PR files
            const filesStartTime = performance.now();
            const prFiles = await invoke<PrFile[]>("get_pr_files");
            logPerformance(
                "invoke get_pr_files",
                filesStartTime,
                `(${prFiles.length} files)`,
            );

            setFiles(prFiles);
            logPerformance("total data fetching", fetchStartTime);
        } catch (err) {
            setError(`Error: ${err}`);
            setFiles([]);
        } finally {
            setLoading(false);
            logPerformance("setArchiveAndFetchFiles total", startTime);
        }
    }

    // Search PRs using the backend search function
    async function searchPRs(searchTerm: string) {
        if (!searchTerm.trim()) {
            setSearchResults(null);
            return;
        }

        const startTime = performance.now();
        setSearchLoading(true);
        setError("");

        try {
            const results = await invoke<PrFile[]>("search_prs", {
                query: searchTerm,
            });
            setSearchResults(results);
            logPerformance(
                "search_prs backend search",
                startTime,
                `(${results.length} results)`,
            );
        } catch (err) {
            setError(`Search error: ${err}`);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }

    // Handle search input changes
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const startTime = performance.now();
        const newTerm = e.target.value;
        setSearchTerm(newTerm);
        searchPRs(newTerm);

        // Clear search results when input is cleared
        if (newTerm.trim() === "") {
            setSearchResults(null);
        }

        logPerformance("searchTerm update", startTime);
    };

    // Format files for the FileViewer component
    const formattedFiles = (
        !searchTerm.trim() ? files : searchResults ?? []
    ).map((file) => ({
        item: file,
        refIndex: -1,
    }));

    return (
        <div className="center-container">
            <div className="home-head">
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
                        <div className="search-controls">
                            <input
                                type="text"
                                placeholder="Search PRs by number, title, or author..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                            />
                        </div>
                    </div>
                )}

                <div className="search-section">
                    <div className="search-controls">
                        <input
                            type="text"
                            placeholder="Enter path to repository..."
                            value={repoPath}
                            onChange={(e) => setRepoPath(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    invoke("set_git_repo", {
                                        filePath: repoPath,
                                    }).then((e) => {
                                        console.log(e);
                                    });
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="home-content">
                {loading ? (
                    <p>Loading PRs...</p>
                ) : searchLoading ? (
                    <p>Searching...</p>
                ) : (
                    <FileViewer files={formattedFiles} />
                )}
            </div>
        </div>
    );
}

export default Home;
