# Deployment Guide - Render.com

This guide explains how to deploy the DCA Backtest Tool to Render.com.

## Prerequisites

- GitHub account with this repository
- Render.com account (free tier available)
- **No API keys required!** (uses free Yahoo Finance via yfinance)

## Deployment Steps

### 1. Push to GitHub

Ensure all your code is pushed to GitHub:

```bash
git push origin main
```

### 2. Connect to Render

1. Go to [Render.com](https://render.com) and sign in
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account if not already connected
4. Select the `DCA-Backtest-Tool` repository
5. Render will automatically detect the `render.yaml` configuration

### 3. Configure Environment Variables (Optional)

The app works out of the box with Yahoo Finance (free, no API key needed)!

If you want to use alternative data providers in the future, you can add API keys later:

#### Backend Service (dca-backtest-api):

The default configuration in `render.yaml` sets:
- `DATA_PROVIDER=yfinance` (free, no key needed)
- `NODE_ENV=production`
- `PORT=3001`

**Optional**: To use paid providers, add these in Render dashboard → Environment tab:
```
ALPHA_VANTAGE_API_KEY=your_key  # For Alpha Vantage (25 req/day)
FMP_API_KEY=your_key             # For Financial Modeling Prep
TIINGO_API_KEY=your_key          # For Tiingo
DATA_PROVIDER=alphavantage       # Change provider (default: yfinance)
```

### 4. Deploy

1. Click **"Apply"** or **"Create Blueprint Instance"**
2. Render will:
   - Build and deploy the backend API
   - Build and deploy the frontend static site
   - Automatically connect them together

The deployment will take 5-10 minutes on first deploy.

### 5. Access Your Application

Once deployed, Render will provide URLs:

- **Frontend**: `https://dca-backtest-frontend.onrender.com`
- **Backend API**: `https://dca-backtest-api.onrender.com`
- **Database Viewer**: `https://dca-backtest-api.onrender.com/db-viewer`

The frontend will automatically connect to the backend API.

## Configuration Details

### Backend Service

- **Type**: Web Service (Node.js)
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Port**: 3001
- **Health Check**: `/health`

### Frontend Service

- **Type**: Static Site
- **Build Command**: `cd frontend && npm install && REACT_APP_API_URL=$BACKEND_URL npm run build`
- **Publish Directory**: `frontend/build`

The frontend automatically uses the backend URL via the `REACT_APP_API_URL` environment variable.

## Free Tier Limitations

Render's free tier includes:

- ✅ 750 hours/month (enough for continuous operation)
- ⚠️ Services sleep after 15 minutes of inactivity
- ⚠️ Cold start: ~30 seconds when waking from sleep
- ✅ Automatic HTTPS
- ✅ Auto-deploy on git push

## Upgrade Options

To avoid cold starts and get always-on services:

1. **Starter Plan**: $7/month per service ($14/month total)
   - No cold starts
   - Always-on
   - More resources

2. **Professional Plan**: $25/month per service
   - Higher performance
   - More resources
   - Priority support

## Auto-Deploy

Render is configured to auto-deploy when you push to the `main` branch:

```bash
# Make changes
git add .
git commit -m "feat: your changes"
git push origin main

# Render automatically deploys!
```

## Monitoring

### View Logs

1. Go to Render dashboard
2. Select your service (backend or frontend)
3. Click **"Logs"** tab to see real-time logs

### Health Check

Backend health check endpoint:

```bash
curl https://dca-backtest-api.onrender.com/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "2024-11-19T..."
}
```

### Database Viewer

Access the database viewer to inspect the SQLite database:

```
https://dca-backtest-api.onrender.com/db-viewer
```

Features:
- Browse all database tables
- View table schemas
- Execute read-only SQL queries
- Filter price data by stock and date range
- Paginated results for large datasets

### Database Info API

Check database statistics programmatically:

```bash
curl https://dca-backtest-api.onrender.com/api/db/info
```

Returns:
```json
{
  "database": {
    "path": "/app/backend/stocks.db",
    "size_mb": "126.00",
    "modified": "2024-11-19T...",
    "created": "2024-11-15T..."
  },
  "tables": [
    {"table": "stocks", "count": 552},
    {"table": "daily_prices", "count": 666196},
    {"table": "stock_beta", "count": 539}
  ],
  "summary": {
    "total_rows": 667287,
    "stocks_count": 552,
    "price_records": 666196,
    "beta_values": 539
  },
  "server": {
    "hostname": "...",
    "platform": "linux",
    "uptime_seconds": 3600
  }
}
```

**Use this to:**
- Monitor database size on Render
- Verify data persistence across deployments
- Check how many stocks and price records are cached

**Note:** The database is stored on disk and will persist between restarts, but may be reset on redeployments in free tier.

## Troubleshooting

### Backend Not Starting

1. Check logs in Render dashboard
2. Verify environment variables are set correctly
3. Ensure `package.json` has correct start script

### Frontend Can't Connect to Backend

1. Check that `REACT_APP_API_URL` is set correctly
2. Verify backend service is running
3. Check CORS configuration in backend

### Database Issues

SQLite database files are stored on disk. On Render's free tier, disk storage is ephemeral and may reset. For production, consider:

- Using Render's PostgreSQL addon
- Migrating from SQLite to PostgreSQL

### Cold Start Issues

Free tier services sleep after 15 minutes. To keep your service warm:

- Upgrade to paid plan ($7/month)
- Or use a monitoring service to ping every 10 minutes

## Local Development

The app still works locally with the same code:

```bash
# Backend (Terminal 1)
cd backend
npm start

# Frontend (Terminal 2)
cd frontend
npm start
```

Frontend automatically uses `http://localhost:3001` in development (see `frontend/src/config/api.js`).

## Environment Variables Reference

### Backend (.env)

```bash
DATA_PROVIDER=yfinance  # Free Yahoo Finance (default)
PORT=3001
NODE_ENV=production

# Optional - only if using paid providers
# ALPHA_VANTAGE_API_KEY=your_key
# FMP_API_KEY=your_key
# TIINGO_API_KEY=your_key
```

### Frontend

```bash
REACT_APP_API_URL=https://dca-backtest-api.onrender.com
```

(Set automatically by Render using `render.yaml`)

## Security Notes

- Never commit API keys to git
- Use Render's environment variables for secrets
- HTTPS is automatically enabled by Render
- CORS is configured in backend for security

## Support

- Render Docs: https://render.com/docs
- GitHub Issues: https://github.com/kevinw99/DCA-Backtest-Tool/issues

---

**Ready to deploy?** Follow the steps above and your app will be live in minutes!
