import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PrData, PrIndexEntry } from '../types/interfaces';
import PrViewer from './PrViewer';

function PrDetails({ indexData }: {indexDat: PrIndexEntry[]}) {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  const [prData, setPrData] = useState<PrData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Retrieve data from localStorage
    const storedData = localStorage.getItem('currentPrData');

    if (!storedData) {
      setError('No PR data found. Please select a PR from the main page.');
      setLoading(false);
      return;
    }

    try {
      const parsedData = JSON.parse(storedData);
      setPrData(parsedData);
    } catch (err) {
      setError(`Failed to parse PR data: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [prNumber]);

  function goBack() {
    navigate('/');
  }

  if (loading) {
    return <div className="loading">Loading PR details...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error">{error}</p>
        <button onClick={goBack}>Back to PR List</button>
      </div>
    );
  }

  return <PrViewer prData={prData} onBack={goBack} />;
}

export default PrDetails;