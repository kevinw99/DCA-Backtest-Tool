const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 8080;

// Database path
const DB_PATH = path.join(__dirname, 'stocks.db');

// Serve static HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Stock Database Viewer</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          margin-top: 0;
        }
        .db-info {
          background: #e8f4f8;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          color: #555;
          border-bottom: 2px solid #4CAF50;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #f0f0f0;
          font-weight: 600;
          position: sticky;
          top: 0;
        }
        tr:hover {
          background: #f9f9f9;
        }
        .query-box {
          margin-bottom: 20px;
        }
        textarea {
          width: 100%;
          min-height: 100px;
          padding: 10px;
          font-family: monospace;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 10px;
        }
        button:hover {
          background: #45a049;
        }
        .table-container {
          max-height: 600px;
          overflow: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .error {
          background: #fee;
          color: #c00;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
        }
        .stock-select {
          padding: 8px;
          margin-bottom: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 200px;
        }
        .date-filters {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: center;
        }
        .date-filters input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .quick-links {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .quick-links button {
          background: #2196F3;
          padding: 8px 16px;
        }
        .quick-links button:hover {
          background: #0b7dda;
        }
        .table-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        .table-card {
          background: #f8f9fa;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .table-card:hover {
          background: #e8f4f8;
          border-color: #4CAF50;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .table-card h3 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 18px;
        }
        .table-card .row-count {
          color: #666;
          font-size: 14px;
        }
        .pagination {
          display: flex;
          gap: 10px;
          margin: 15px 0;
          align-items: center;
        }
        .pagination button {
          padding: 6px 12px;
        }
        .pagination button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .pagination .page-info {
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📊 Stock Database Viewer</h1>
        <div class="db-info">
          <strong>Database:</strong> ${DB_PATH}<br>
          <strong>Server:</strong> http://localhost:${PORT}
        </div>

        <div class="section">
          <h2>Browse Tables</h2>
          <div id="tables-list">Loading...</div>
        </div>

        <div class="section">
          <h2>Database Schema</h2>
          <div id="schema-info">Loading...</div>
        </div>

        <div class="section">
          <h2>Quick Views</h2>
          <div class="quick-links">
            <button onclick="loadStocks()">View All Stocks</button>
            <button onclick="loadPricesSample()">Sample Price Data</button>
            <button onclick="loadPricesWithStock()">Prices with Stock Info</button>
            <button onclick="showPricesByStock()">Price Data by Stock</button>
          </div>
        </div>

        <div class="section" id="stock-prices-section" style="display:none;">
          <h2>Price Data by Stock</h2>
          <div class="date-filters">
            <select id="stock-select" class="stock-select" onchange="loadPricesForStock()">
              <option value="">Select a stock...</option>
            </select>
            <label>From: <input type="date" id="date-from" value="2024-01-01"></label>
            <label>To: <input type="date" id="date-to" value="2025-01-01"></label>
            <button onclick="loadPricesForStock()">Apply Filters</button>
          </div>
          <div class="table-container" id="stock-prices-table"></div>
        </div>

        <div class="section">
          <h2>Custom SQL Query</h2>
          <div class="query-box">
            <textarea id="sql-query" placeholder="Enter SQL query here...">SELECT * FROM stocks LIMIT 10;</textarea>
            <button onclick="runQuery()">Run Query</button>
          </div>
          <div class="table-container" id="query-results"></div>
        </div>

        <div class="section">
          <h2>Query Results</h2>
          <div class="table-container" id="main-results"></div>
        </div>
      </div>

      <script>
        async function runQuery() {
          const query = document.getElementById('sql-query').value;
          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
          });
          const data = await response.json();
          displayResults(data, 'query-results');
        }

        async function loadStocks() {
          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'SELECT * FROM stocks ORDER BY symbol' })
          });
          const data = await response.json();
          displayResults(data, 'main-results');
        }

        async function loadPricesSample() {
          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'SELECT * FROM prices LIMIT 100' })
          });
          const data = await response.json();
          displayResults(data, 'main-results');
        }

        async function loadPricesWithStock() {
          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: \`
              SELECT s.symbol, p.date, p.open, p.high, p.low, p.close, p.volume
              FROM prices p
              JOIN stocks s ON p.stock_id = s.id
              ORDER BY p.date DESC
              LIMIT 100
            \` })
          });
          const data = await response.json();
          displayResults(data, 'main-results');
        }

        async function showPricesByStock() {
          document.getElementById('stock-prices-section').style.display = 'block';
          // Load stock list
          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'SELECT id, symbol FROM stocks ORDER BY symbol' })
          });
          const data = await response.json();
          const select = document.getElementById('stock-select');
          select.innerHTML = '<option value="">Select a stock...</option>';
          if (data.rows) {
            data.rows.forEach(row => {
              const option = document.createElement('option');
              option.value = row.id;
              option.textContent = row.symbol;
              select.appendChild(option);
            });
          }
        }

        async function loadPricesForStock() {
          const stockId = document.getElementById('stock-select').value;
          if (!stockId) return;

          const dateFrom = document.getElementById('date-from').value;
          const dateTo = document.getElementById('date-to').value;

          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: \`
              SELECT s.symbol, p.date, p.open, p.high, p.low, p.close, p.volume,
                     p.sma_20, p.sma_50, p.ema_12, p.ema_26, p.rsi
              FROM prices p
              JOIN stocks s ON p.stock_id = s.id
              WHERE p.stock_id = \${stockId}
                AND p.date >= '\${dateFrom}'
                AND p.date <= '\${dateTo}'
              ORDER BY p.date DESC
              LIMIT 1000
            \` })
          });
          const data = await response.json();
          displayResults(data, 'stock-prices-table');
        }

        function displayResults(data, targetId) {
          const container = document.getElementById(targetId);
          if (data.error) {
            container.innerHTML = \`<div class="error">\${data.error}</div>\`;
            return;
          }

          if (!data.rows || data.rows.length === 0) {
            container.innerHTML = '<p>No results found.</p>';
            return;
          }

          const columns = data.columns;
          let html = '<table><thead><tr>';
          columns.forEach(col => {
            html += \`<th>\${col}</th>\`;
          });
          html += '</tr></thead><tbody>';

          data.rows.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
              const value = row[col];
              html += \`<td>\${value !== null && value !== undefined ? value : ''}</td>\`;
            });
            html += '</tr>';
          });

          html += '</tbody></table>';
          container.innerHTML = html;
        }

        let currentTable = '';
        let currentPage = 0;
        const pageSize = 100;

        // Load tables list
        async function loadTablesList() {
          const response = await fetch('/tables');
          const data = await response.json();
          const container = document.getElementById('tables-list');

          let html = '<div class="table-list">';
          data.tables.forEach(table => {
            html += \`
              <div class="table-card" onclick="browseTable('\${table.name}')">
                <h3>\${table.name}</h3>
                <div class="row-count">\${table.count} rows</div>
              </div>
            \`;
          });
          html += '</div>';
          container.innerHTML = html;
        }

        async function browseTable(tableName, page = 0) {
          currentTable = tableName;
          currentPage = page;
          const offset = page * pageSize;

          const response = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: \`SELECT * FROM \${tableName} LIMIT \${pageSize} OFFSET \${offset}\`
            })
          });
          const data = await response.json();

          // Get total count
          const countResponse = await fetch('/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: \`SELECT COUNT(*) as total FROM \${tableName}\` })
          });
          const countData = await countResponse.json();
          const totalRows = countData.rows[0].total;
          const totalPages = Math.ceil(totalRows / pageSize);

          let html = \`
            <h3>Table: \${tableName} (\${totalRows} total rows)</h3>
            <div class="pagination">
              <button onclick="browseTable('\${tableName}', \${page - 1})" \${page === 0 ? 'disabled' : ''}>
                ← Previous
              </button>
              <span class="page-info">Page \${page + 1} of \${totalPages}</span>
              <button onclick="browseTable('\${tableName}', \${page + 1})" \${page >= totalPages - 1 ? 'disabled' : ''}>
                Next →
              </button>
              <button onclick="document.getElementById('main-results').innerHTML = ''">
                Clear
              </button>
            </div>
          \`;

          const resultsContainer = document.createElement('div');
          resultsContainer.innerHTML = html;

          displayResults(data, 'main-results');
          document.getElementById('main-results').insertAdjacentHTML('afterbegin', html);

          // Scroll to results
          document.getElementById('main-results').scrollIntoView({ behavior: 'smooth' });
        }

        // Load schema on page load
        async function loadSchema() {
          const response = await fetch('/schema');
          const data = await response.json();
          const container = document.getElementById('schema-info');

          let html = '<table><thead><tr><th>Table</th><th>SQL</th></tr></thead><tbody>';
          data.tables.forEach(table => {
            html += \`<tr><td><strong>\${table.name}</strong></td><td><code>\${table.sql}</code></td></tr>\`;
          });
          html += '</tbody></table>';
          container.innerHTML = html;
        }

        loadSchema();
        loadTablesList();
      </script>
    </body>
    </html>
  `);
});

// API endpoint for tables with row counts
app.get('/tables', (req, res) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      res.json({ error: err.message });
      db.close();
      return;
    }

    const tablePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
          if (err) reject(err);
          else resolve({ name: table.name, count: row.count });
        });
      });
    });

    Promise.all(tablePromises)
      .then(tablesWithCounts => {
        res.json({ tables: tablesWithCounts });
        db.close();
      })
      .catch(err => {
        res.json({ error: err.message });
        db.close();
      });
  });
});

// API endpoint for schema
app.get('/schema', (req, res) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

  db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      res.json({ tables: rows });
    }
    db.close();
  });
});

// API endpoint for queries
app.use(express.json());
app.post('/query', (req, res) => {
  const { query } = req.body;
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

  db.all(query, (err, rows) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      res.json({ columns, rows });
    }
    db.close();
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('✅ Database Viewer running at http://localhost:' + PORT);
  console.log('   Database: ' + DB_PATH);
  console.log('');
});
