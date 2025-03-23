import { useState, useEffect } from "react";
import { useParams, useNavigate, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { PrData } from "../types/interfaces";
import PrViewer from "./PrViewer";
import { useAppContext } from "../AppContext";
import style from "./PrViewer.module.css" with { type: "css" };

function PrDetails() {
    const { prNumber: prNumberStr } = useParams<{ prNumber: string }>();
    const navigate = useNavigate();
    const [prData, setPrData] = useState<PrData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const { files: indexData } = useAppContext();

    const prNumber = Number(prNumberStr);

    useEffect(() => {
        async function fetchPrData() {
            setLoading(true);
            setError("");

            try {
                // Find the corresponding index entry
                const entry = indexData.find(
                    (entry) => entry.pr_number === prNumber,
                );

                if (!entry) {
                    setError(`PR #${prNumber} not found in index.`);
                    setLoading(false);
                    return;
                }

                const content = await invoke<string>("read_pr_file", {
                    path: entry.archive_path,
                });

                // Parse the PR JSON data
                const parsedData: PrData = JSON.parse(content);

                // Merge index entry data with PR data if needed fields are missing
                const enhancedData: PrData = {
                    ...parsedData,
                    id: parsedData.id || entry.pr_number,
                    title: parsedData.title || entry.title,
                    created_by: parsedData.created_by || entry.author,
                    creation_date:
                        parsedData.creation_date || entry.creation_date,
                    status: parsedData.status || entry.status,
                    repository: parsedData.repository,
                    source_branch:
                        parsedData.source_branch || entry.source_branch,
                    target_branch:
                        parsedData.target_branch || entry.target_branch,
                };

                setPrData(enhancedData);
            } catch (err) {
                setError(`Failed to load PR data: ${err}`);
                setPrData(null);
            } finally {
                setLoading(false);
            }
        }

        if (prNumber && indexData.length > 0) {
            fetchPrData();
        } else if (indexData.length === 0) {
            setError(
                "Index data not loaded. Please return to the main page and select an archive.",
            );
            setLoading(false);
        }
    }, [prNumber, indexData]);

    // Redirect to overview tab if accessed directly at /pr/:prNumber
    useEffect(() => {
        if (
            !loading &&
            !error &&
            prData &&
            window.location.pathname === `/pr/${prNumber}`
        ) {
            navigate(`/pr/${prNumber}/overview`, { replace: true });
        }
    }, [loading, error, prData, navigate, prNumber]);

    function goBack() {
        navigate("/");
    }

    if (loading) {
        return (
            <div className={`${style["pr-details"]} ${style.loading}`}>
                Loading PR data...
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${style["pr-details"]} ${style.error}`}>
                <h2>Error</h2>
                <p>{error}</p>
                <button onClick={goBack} className="back-button">
                    Back to PR List
                </button>
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="*"
                element={<PrViewer prData={prData} onBack={goBack} />}
            />
            <Route
                path="overview"
                element={<PrViewer prData={prData} onBack={goBack} />}
            />
            <Route
                path="changes"
                element={<PrViewer prData={prData} onBack={goBack} />}
            />
        </Routes>
    );
}

export default PrDetails;
