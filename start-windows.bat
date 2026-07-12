@echo off
echo =========================================
echo  Starting AssetFlow Development Stack
echo =========================================

echo ^> [1/4] Starting PostgreSQL Database...
cd database
docker-compose up -d
cd ..

echo Waiting a few seconds for the database to be ready...
timeout /t 5 /nobreak > nul

echo ^> [2/4] Setting up Database Schema ^& Seeding...
cd backend
echo DATABASE_URL="postgresql://assetflow_user:assetflow_password@localhost:5432/assetflow?schema=public" > .env
echo Created/Updated backend/.env file.
call npx prisma generate
call npx prisma db push
call npx prisma db seed
echo Database ready!
cd ..

echo ^> [3/4] Starting Backend (NestJS on port 4000)...
cd backend
start "AssetFlow Backend" cmd /k "npm run start:dev"
cd ..

echo ^> [4/4] Starting Frontend (Next.js on port 3000)...
cd frontend
start "AssetFlow Frontend" cmd /k "npm run dev"
cd ..

echo =========================================
echo  All services are starting up!
echo  Frontend: http://localhost:3000
echo  Backend : http://localhost:4000
echo.
echo  Note: This opened two new terminal windows for the frontend and backend.
echo  To stop the services, simply close those terminal windows, and manually
echo  run 'docker-compose down' in the database folder to stop Postgres.
echo =========================================
pause
