#!/bin/bash

# Voting Workshop Points Dashboard Launcher
# This script helps you set up and run the points dashboard

echo "⭐ Voting Workshop Points Dashboard"
echo "==================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo ""

# Check if virtual environment exists
if [ ! -d "venv-dashboard" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv-dashboard
    echo "✅ Virtual environment created"
    echo ""
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv-dashboard/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements-dashboard.txt
echo "✅ Dependencies installed"
echo ""

# Check for RPC URL
if [ -z "$RPC_URL" ]; then
    echo "⚠️  RPC_URL environment variable not set"
    echo "   You'll need to enter your RPC URL in the dashboard"
    echo ""
else
    echo "✅ RPC_URL configured"
    echo ""
fi

echo "🚀 Starting points dashboard..."
echo ""
echo "   Dashboard will open at: http://localhost:8501"
echo "   Press Ctrl+C to stop the dashboard"
echo ""

# Run Streamlit
streamlit run points-dashboard.py

