#!/bin/bash

# Exit on error for initial setup
set -e

echo "========================================="
echo " Starting AssetFlow Development Stack"
echo "========================================="

# 1. Start Database
echo ">>> [1/4] Starting PostgreSQL Database..."
cd database
docker-compose up -d
cd ..

echo "Waiting a few seconds for the database to be ready..."
sleep 5

# 2. Setup Backend & DB Schema
echo ">>> [2/4] Setting up Database Schema & Seeding..."
cd backend
echo 'DATABASE_URL="postgresql://assetflow_user:assetflow_password@localhost:5432/assetflow?schema=public"' > .env
echo "Created/Updated backend/.env file."

npx prisma generate
npx prisma db push
npx prisma db seed
echo "Database ready!"

# Turn off exit on error so that manual stopping doesn't immediately crash everything
set +e

# 3. Start Backend
echo ">>> [3/4] Starting Backend (NestJS on port 4000)..."
npm run start:dev &
BACKEND_PID=$!
cd ..

# 4. Start Frontend
echo ">>> [4/4] Starting Frontend (Next.js on port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================="
echo " All services are starting up!"
echo " Frontend: http://localhost:3000"
echo " Backend : http://localhost:4000"
echo ""
echo " Press Ctrl+C to stop all services."
echo "========================================="

# Trap SIGINT to gracefully kill background processes
trap "echo -e '\nStopping all services...'; kill $BACKEND_PID $FRONTEND_PID; cd database && docker-compose down; echo 'Done!'; exit 0" SIGINT SIGTERM

# Wait indefinitely for processes
wait $BACKEND_PID $FRONTEND_PID
