@echo off
:: AssetFlow — local Postgres backup script
:: Usage: backup.bat [output_file]
:: Default output: backups\assetflow_YYYYMMDD_HHMMSS.dump

setlocal

set PGHOST=localhost
set PGPORT=5432
set PGUSER=assetflow_user
set PGPASSWORD=assetflow_password
set PGDATABASE=assetflow

if not exist "backups" mkdir backups

:: Build timestamp string
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set TSTAMP=%dt:~0,8%_%dt:~8,6%

if "%~1"=="" (
  set OUTFILE=backups\assetflow_%TSTAMP%.dump
) else (
  set OUTFILE=%~1
)

echo Backing up AssetFlow database to %OUTFILE% ...
pg_dump -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -Fc -f "%OUTFILE%"

if %ERRORLEVEL%==0 (
  echo Done: %OUTFILE%
) else (
  echo ERROR: pg_dump failed. Make sure pg_dump is on your PATH and the container is running.
)
