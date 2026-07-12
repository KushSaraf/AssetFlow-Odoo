@echo off
:: AssetFlow — local Postgres restore script
:: Usage: restore.bat <dump_file>

setlocal

if "%~1"=="" (
  echo Usage: restore.bat ^<dump_file^>
  echo Example: restore.bat backups\assetflow_20260712_120000.dump
  exit /b 1
)

set PGHOST=localhost
set PGPORT=5432
set PGUSER=assetflow_user
set PGPASSWORD=assetflow_password
set PGDATABASE=assetflow
set DUMPFILE=%~1

if not exist "%DUMPFILE%" (
  echo ERROR: File not found: %DUMPFILE%
  exit /b 1
)

echo WARNING: This will DROP and recreate the assetflow database!
set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
  echo Aborted.
  exit /b 0
)

echo Dropping and recreating database...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d postgres -c "DROP DATABASE IF EXISTS assetflow;"
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d postgres -c "CREATE DATABASE assetflow OWNER assetflow_user;"

echo Restoring from %DUMPFILE% ...
pg_restore -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% --no-owner --role=%PGUSER% "%DUMPFILE%"

if %ERRORLEVEL%==0 (
  echo Restore complete.
) else (
  echo ERROR: pg_restore failed.
)
