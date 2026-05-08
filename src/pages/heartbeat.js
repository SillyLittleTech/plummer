export function heartbeatPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plummer — Heartbeat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      padding: 40px;
      max-width: 600px;
      text-align: center;
    }
    .status {
      font-size: 48px;
      margin-bottom: 10px;
    }
    h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 30px;
    }
    .diagnostic {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 20px;
      text-align: left;
      margin-bottom: 20px;
    }
    .diagnostic h3 {
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    .diagnostic-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .diagnostic-item:last-child {
      border-bottom: none;
    }
    .diagnostic-label {
      color: #666;
      font-weight: 500;
    }
    .diagnostic-value {
      color: #333;
      font-family: monospace;
      font-size: 13px;
    }
    .footer {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="status">✓</div>
    <h1>Service Up</h1>
    <div class="badge">Operational</div>
    <div class="diagnostic">
      <h3>Diagnostic Information</h3>
      <div class="diagnostic-item">
        <span class="diagnostic-label">Timestamp</span>
        <span class="diagnostic-value">${new Date().toISOString()}</span>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">Service</span>
        <span class="diagnostic-value">Plummer</span>
      </div>
      <div class="diagnostic-item">
        <span class="diagnostic-label">Status</span>
        <span class="diagnostic-value">Healthy</span>
      </div>
    </div>
    <div class="footer">
      Redirect chain verified. All systems nominal.
    </div>
  </div>
</body>
</html>`;
}
