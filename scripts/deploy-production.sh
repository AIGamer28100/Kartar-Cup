#!/bin/bash
# Production Deployment Script for Kartar Cup
# Usage: ./scripts/deploy-production.sh [staging|production]

set -e

ENVIRONMENT=${1:-production}
PROJECT_ID="kartar-cup"

echo "🚀 Deploying Kartar Cup to $ENVIRONMENT..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_tool() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}Error: $1 is not installed${NC}"
    exit 1
  fi
}

echo "🔍 Checking prerequisites..."
check_tool "npx"
check_tool "firebase"

# Verify we're in the right directory
if [ ! -f "firebase.json" ]; then
  echo -e "${RED}Error: firebase.json not found. Run from project root.${NC}"
  exit 1
fi

# Check for environment file
if [ "$ENVIRONMENT" = "production" ]; then
  if [ ! -f ".env.production.local" ]; then
    echo -e "${YELLOW}Warning: .env.production.local not found${NC}"
    echo "Create it from .env.production.example with your production values"
  fi
else
  if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
  fi
fi

# Run tests
echo "🧪 Running tests..."
npm run test
if [ $? -ne 0 ]; then
  echo -e "${RED}Tests failed! Aborting deployment.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"

# Build functions
echo "⚙️  Building Cloud Functions..."
npm run functions:build
if [ $? -ne 0 ]; then
  echo -e "${RED}Functions build failed! Aborting deployment.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Functions built${NC}"

# Build frontend
echo "🏗️  Building frontend..."
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}Frontend build failed! Aborting deployment.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend built${NC}"

# Deploy based on environment
if [ "$ENVIRONMENT" = "production" ]; then
  echo "📦 Deploying to PRODUCTION..."
  echo -e "${YELLOW}⚠️  This will deploy to production. Continue? (y/N)${NC}"
  read -r CONFIRM
  if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
  
  # Deploy everything with explicit project flag
  firebase deploy --project $PROJECT_ID
else
  echo "📦 Deploying to STAGING..."
  firebase deploy --project $PROJECT_ID-staging
fi

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo "🌐 Your app is live at: https://$PROJECT_ID.web.app"
else
  echo -e "${RED}❌ Deployment failed!${NC}"
  exit 1
fi