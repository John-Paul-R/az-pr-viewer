import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import FileViewer from "./components/FileViewer";
import PrDetails from "./components/PrDetails";
import { PrFile, PrIndexEntry } from "./types/interfaces";
import reactLogo from "./assets/react.svg";
import "./App.css";
import "./FilesApp.css";

function App() {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        setGreetMsg(await invoke("greet", { name }));
    }

    return (
        <main className="container">
            <FilesApp />
        </main>
    );
}

function FilesApp() {
    const [archiveFile, setArchiveFile] = useState<string>("");
    const [files, setFiles] = useState<PrFile[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [indexData, setIndexData] = useState<PrIndexEntry[]>([]);

    // Function to select tar.gz file
    async function selectArchiveFile() {
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
                await setArchiveAndFetchFiles(selected);
            }
        } catch (err) {
            setError(`Failed to open archive file: ${err}`);
        }
    }

    // Function to set archive file in Rust backend and fetch files
    async function setArchiveAndFetchFiles(archivePath: string) {
        setLoading(true);
        setError("");

        try {
            // Set the archive file in the backend
            await invoke("set_archive_file", { newArchive: archivePath });

            // Get the index content
            const indexContent = await invoke<string>("get_index_content");
            const indexEntries = JSON.parse(indexContent) as PrIndexEntry[];
            setIndexData(indexEntries);

            // Get PR files
            const prFiles = await invoke<PrFile[]>("get_pr_files");

            // Enhance PR files with title and author from index
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

            setFiles(enhancedFiles);
        } catch (err) {
            setError(`Error: ${err}`);
            setFiles([]);
            setIndexData([]);
        } finally {
            setLoading(false);
        }
    }

    // Filter files based on search term (now includes title and author)
    const filteredFiles = files.filter(
        (file) =>
            file.pr_number.includes(searchTerm) ||
            file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.author?.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <Router>
            <Routes>
                <Route
                    path="/"
                    element={
                        <div className="center-container">
                            <h1>PR JSON Viewer</h1>

                            <div className="directory-section">
                                <button
                                    type="button"
                                    onClick={selectArchiveFile}
                                >
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
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                    />
                                </div>
                            )}

                            {loading ? (
                                <p>Loading PRs...</p>
                            ) : (
                                <FileViewer files={filteredFiles} />
                            )}
                        </div>
                    }
                />

                <Route
                    path="/pr/:prNumber"
                    element={<PrDetails indexData={indexData} />}
                />
                <Route path="*" element={<div>fallback!</div>} />
            </Routes>
        </Router>
    );
}

export default App;
