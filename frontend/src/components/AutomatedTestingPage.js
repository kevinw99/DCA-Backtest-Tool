import React, { useState, useEffect } from 'react';
import './AutomatedTestingPage.css';
import { getApiUrl } from '../config/api';

function AutomatedTestingPage() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [archives, setArchives] = useState([]);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    try {
      const response = await fetch(getApiUrl('/api/test/archives'));
      const data = await response.json();

      if (data.success) {
        setArchives(data.data);
      }
    } catch (err) {
      console.error('Failed to load archives:', err);
    }
  };

  const runTest = async () => {
    if (!description.trim()) {
      setError('Please enter a test description');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(getApiUrl('/api/test/automated'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Test execution failed');
      }

      setResult(data.data);
      setDescription(''); // Clear description after successful run

      // Reload archives
      await loadArchives();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    {
      category: 'Portfolio Tests',
      items: [
        'portfolio backtest with beta > 1.75',
        'portfolio backtest with beta < 1.0',
        'portfolio backtest with stocks: [AAPL, MSFT, GOOGL]',
      ]
    },
    {
      category: 'Batch Tests',
      items: [
        'batch testing gridIntervalPercent values [5, 10, 15, 20] for AAPL',
        'batch testing profitRequirement values [5, 10, 15] for NVDA',
      ]
    },
    {
      category: 'Single Tests',
      items: [
        'single backtest for AAPL with beta scaling enabled',
        'single backtest for NVDA with gridInterval=15',
      ]
    }
  ];

  return (
    <div className="automated-testing-page">
      <div className="page-header">
        <h1>Automated Test Execution</h1>
        <p>Describe your test in natural language and let the system handle the rest</p>
      </div>

      <div className="test-input-section">
        <div className="input-container">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your test (e.g., 'portfolio backtest with beta > 1.75')..."
            rows="3"
            disabled={loading}
          />
          <button
            onClick={runTest}
            disabled={loading || !description.trim()}
            className="run-button"
          >
            {loading ? 'Running Test...' : 'Run Test'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="success-message">
            <h3>Test Completed Successfully!</h3>
            <div className="result-details">
              <p><strong>Archive:</strong> <code>{result.archivePath}</code></p>
              <p><strong>Duration:</strong> {result.duration}s</p>
              <div className="result-actions">
                <a
                  href={`/test-results/${result.archivePath}/result.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  View Results
                </a>
                <a
                  href={result.frontendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  Open Frontend URL
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="examples-section">
        <h2>Example Test Descriptions</h2>
        <div className="examples-grid">
          {examples.map((category, idx) => (
            <div key={idx} className="example-category">
              <h3>{category.category}</h3>
              <ul>
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <button
                      onClick={() => setDescription(item)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    >
                      <code>{item}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="archives-section">
        <div className="section-header">
          <h2>Test Archive</h2>
          <a href="/test-results/index.html" target="_blank" rel="noopener noreferrer" className="view-all-link">
            View Full Archive Index
          </a>
        </div>

        {archives.length === 0 ? (
          <p className="no-archives">No test archives yet. Run your first test above!</p>
        ) : (
          <table className="archives-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archives.slice(0, 10).map((archive, idx) => (
                <tr key={idx}>
                  <td className="timestamp">
                    {new Date(archive.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span className={`test-type ${archive.testType}`}>
                      {archive.testType}
                    </span>
                  </td>
                  <td>{archive.description}</td>
                  <td>
                    <a
                      href={`/test-results/${archive.folder}/result.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="action-link"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AutomatedTestingPage;
