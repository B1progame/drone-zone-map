@echo off
setlocal EnableExtensions
title Aeris Official Geodata Tool
cd /d "%~dp0.."
if not exist "exports" mkdir "exports"

:menu
cls
echo =====================================================
echo   AERIS OFFICIAL GEODATA TOOL
echo =====================================================
echo   1. Download a Spanish ENAIRE area as GeoJSON
echo   2. Refresh Luxembourg official CC0 zones
echo   3. Discover endpoints on an official public page
echo   4. Inspect a known public WMS endpoint
echo   5. Validate the 37-country source registry
echo   6. Build and test the website
echo   7. Open the exports folder
echo   0. Exit
echo.
set /p choice=Choose an option: 
if "%choice%"=="1" goto spain
if "%choice%"=="2" goto luxembourg
if "%choice%"=="3" goto discover
if "%choice%"=="4" goto wms
if "%choice%"=="5" goto validate
if "%choice%"=="6" goto build
if "%choice%"=="7" start "" "%cd%\exports" & goto menu
if "%choice%"=="0" exit /b 0
goto menu

:spain
echo.
echo Enter WGS84 bounds as west,south,east,north.
echo Mannheim is not in Spain. Madrid example: -3.75,40.38,-3.65,40.46
set /p bbox=Bounding box: 
set /p filename=Output name without extension [spain-area]: 
if "%filename%"=="" set filename=spain-area
python pipeline\main.py fetch-spain-bbox --bbox="%bbox%" --output "exports\%filename%.geojson"
goto done

:luxembourg
python pipeline\main.py update-luxembourg
goto done

:discover
echo.
echo Use only an official public authority page. This does not bypass logins or robots rules.
set /p sourceurl=Official page URL: 
python pipeline\main.py discover "%sourceurl%" --output "exports\endpoint-discovery.json"
goto done

:wms
set /p wmsurl=Documented public WMS URL: 
python pipeline\main.py inspect-wms "%wmsurl%" --output "exports\wms-report.json"
goto done

:validate
python pipeline\main.py
goto done

:build
call npm.cmd run build
goto done

:done
echo.
if errorlevel 1 (echo FAILED - read the message above.) else (echo Finished successfully.)
pause
goto menu
