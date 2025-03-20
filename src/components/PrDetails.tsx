import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";
import { PrData, PrIndexEntry } from '../types/interfaces';
import PrViewer from './PrViewer';
import './PrDetails.css';

interface PrDetailsProps {
  indexData: PrIndexEntry[];
}

function PrDetails({ indexData }: PrDetailsProps) {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  const [prData, setPrData] = useState<PrData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [indexEntry, setIndexEntry] = useState<PrIndexEntry | null>(null);

  useEffect(() => {
    async function fetchPrData() {
      setLoading(true);
      setError('');

      try {
        // Find the corresponding index entry
        const entry = indexData.find(entry => entry.id.toString() === prNumber);

        if (!entry) {
          setError(`PR #${prNumber} not found in index.`);
          setLoading(false);
          return;
        }

        setIndexEntry(entry);

        // Construct the path to the PR file in the archive
        const path = `prs/${entry.filename}`;
        const content = await invoke<string>('read_pr_file', { path });

        // Parse the PR JSON data
        const parsedData: PrData = JSON.parse(content);

        // Merge index entry data with PR data if needed fields are missing
        const enhancedData: PrData = {
          ...parsedData,
          id: parsedData.id || entry.id,
          title: parsedData.title || entry.title,
          created_by: parsedData.created_by || entry.created_by,
          creation_date: parsedData.creation_date || entry.creation_date,
          status: parsedData.status || entry.status,
          repository: parsedData.repository || entry.repository,
          source_branch: parsedData.source_branch || entry.source_branch,
          target_branch: parsedData.target_branch || entry.target_branch
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
      setError('Index data not loaded. Please return to the main page and select an archive.');
      setLoading(false);
    }
  }, [prNumber, indexData]);

  function goBack() {
    navigate('/');
  }

  if (loading) {
    return <div className="pr-details loading">Loading PR data...</div>;
  }

  if (error) {
    return (
      <div className="pr-details error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={goBack} className="back-button">Back to PR List</button>
      </div>
    );
  }

  return <PrViewer prData={prData} onBack={goBack} />;
}

export default PrDetails;