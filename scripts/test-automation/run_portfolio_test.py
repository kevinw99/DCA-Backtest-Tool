#!/usr/bin/env python3
"""
Spec 56: Automated Test Execution and Archival
Portfolio Backtest Test Runner (MVP Version)

Usage:
    python run_portfolio_test.py <config_name> <description>

Example:
    python run_portfolio_test.py sp500_high_beta "S&P 500 stocks with beta > 1.5"
"""

import os
import sys
import json
import requests
import subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

# Configuration
BACKEND_URL = "http://localhost:3001"
FRONTEND_URL = "http://localhost:3000"
PROJECT_ROOT = Path(__file__).parent.parent.parent
TEST_RESULTS_DIR = PROJECT_ROOT / "test-results"


def create_archive_folder(description):
    """Create timestamped archive folder following Spec 56 naming convention."""
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    slug = description.lower().replace(" ", "-")[:50]
    folder_name = f"{timestamp}_{slug}"
    archive_path = TEST_RESULTS_DIR / folder_name
    archive_path.mkdir(parents=True, exist_ok=True)
    return archive_path


def generate_frontend_url(config_name):
    """Generate frontend URL for portfolio backtest."""
    return f"{FRONTEND_URL}/portfolio-backtest?config={config_name}"


def generate_curl_command(config_name):
    """Generate curl command for portfolio backtest API."""
    return f"""curl -X POST {BACKEND_URL}/api/backtest/portfolio/config \\
  -H "Content-Type: application/json" \\
  -d '{{"configFile": "{config_name}"}}'"""


def execute_portfolio_backtest(config_name):
    """Execute portfolio backtest via API and return JSON response."""
    print(f"📡 Executing portfolio backtest for config: {config_name}")

    api_url = f"{BACKEND_URL}/api/backtest/portfolio/config"
    payload = {"configFile": config_name}

    try:
        response = requests.post(api_url, json=payload, timeout=300)
        response.raise_for_status()
        result = response.json()

        if result.get("success"):
            print(f"✅ Backtest completed successfully")
            return result
        else:
            print(f"❌ Backtest failed: {result.get('error', 'Unknown error')}")
            return result
    except requests.exceptions.RequestException as e:
        print(f"❌ API request failed: {e}")
        return {"success": False, "error": str(e)}


def save_archive_artifacts(archive_path, config_name, description, frontend_url, curl_cmd, api_response):
    """Save all test artifacts to archive folder."""

    # 1. Save README.md
    readme_content = f"""# Portfolio Backtest Test Archive

**Test Description**: {description}
**Config File**: {config_name}
**Timestamp**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Status**: {"✅ Success" if api_response.get("success") else "❌ Failed"}

## Quick Access

**Frontend URL**:
{frontend_url}

**API Endpoint**:
POST {BACKEND_URL}/api/backtest/portfolio/config

## Files in This Archive

- `README.md` - This file
- `config.json` - Portfolio configuration used
- `frontend-url.txt` - Direct link to view results
- `curl-command.sh` - Reproducible API command
- `api-response.json` - Complete API response
- `metadata.json` - Test execution metadata

## Reproduction Steps

1. Ensure backend server is running on port 3001
2. Run the curl command: `bash curl-command.sh`
3. Or visit the frontend URL to view results interactively

"""
    (archive_path / "README.md").write_text(readme_content)

    # 2. Save config.json
    config_path = PROJECT_ROOT / "backend" / "configs" / "portfolios" / f"{config_name}.json"
    if config_path.exists():
        config_content = config_path.read_text()
        (archive_path / "config.json").write_text(config_content)

    # 3. Save frontend-url.txt
    (archive_path / "frontend-url.txt").write_text(frontend_url + "\n")

    # 4. Save curl-command.sh
    curl_script = f"""#!/bin/bash
# Portfolio Backtest API Command
# Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

{curl_cmd}
"""
    curl_file = archive_path / "curl-command.sh"
    curl_file.write_text(curl_script)
    curl_file.chmod(0o755)

    # 5. Save api-response.json
    (archive_path / "api-response.json").write_text(
        json.dumps(api_response, indent=2)
    )

    # 6. Save metadata.json
    metadata = {
        "testType": "portfolio",
        "description": description,
        "configFile": config_name,
        "timestamp": datetime.now().isoformat(),
        "success": api_response.get("success", False),
        "frontendUrl": frontend_url,
        "apiUrl": f"{BACKEND_URL}/api/backtest/portfolio/config",
        "stockCount": len(api_response.get("data", {}).get("stockResults", [])) if api_response.get("success") else 0
    }
    (archive_path / "metadata.json").write_text(
        json.dumps(metadata, indent=2)
    )

    print(f"\n📁 Archive saved to: {archive_path}")
    print(f"   - README.md")
    print(f"   - config.json")
    print(f"   - frontend-url.txt")
    print(f"   - curl-command.sh")
    print(f"   - api-response.json")
    print(f"   - metadata.json")


def main():
    if len(sys.argv) < 3:
        print("Usage: python run_portfolio_test.py <config_name> <description>")
        print('Example: python run_portfolio_test.py sp500_high_beta "S&P 500 stocks with beta > 1.5"')
        sys.exit(1)

    config_name = sys.argv[1]
    description = " ".join(sys.argv[2:])

    print("=" * 80)
    print("📊 Spec 56: Automated Portfolio Backtest Execution")
    print("=" * 80)
    print(f"Config: {config_name}")
    print(f"Description: {description}")
    print()

    # Step 1: Create archive folder
    archive_path = create_archive_folder(description)
    print(f"📂 Created archive folder: {archive_path.name}\n")

    # Step 2: Generate URLs and commands
    frontend_url = generate_frontend_url(config_name)
    curl_cmd = generate_curl_command(config_name)

    print(f"🌐 Frontend URL:")
    print(f"   {frontend_url}\n")

    print(f"📝 Curl Command:")
    print(f"   {curl_cmd}\n")

    # Step 3: Execute backtest
    api_response = execute_portfolio_backtest(config_name)

    # Step 4: Save all artifacts
    save_archive_artifacts(
        archive_path,
        config_name,
        description,
        frontend_url,
        curl_cmd,
        api_response
    )

    # Step 5: Print summary
    print("\n" + "=" * 80)
    if api_response.get("success"):
        data = api_response.get("data", {})
        print("✅ TEST COMPLETED SUCCESSFULLY")
        print("=" * 80)
        print(f"Stocks Tested: {len(data.get('stockResults', []))}")
        print(f"Total P&L: ${data.get('summary', {}).get('totalRealizedPnl', 0):,.2f}")
        print(f"Total ROI: {data.get('summary', {}).get('totalRoi', 0):.2f}%")
    else:
        print("❌ TEST FAILED")
        print("=" * 80)
        print(f"Error: {api_response.get('error', 'Unknown error')}")

    print(f"\n📦 Results archived in: test-results/{archive_path.name}")
    print(f"🌐 View results: {frontend_url}")
    print("=" * 80)


if __name__ == "__main__":
    main()
