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
echo   3. Refresh Ireland official IAA GeoJSON
echo   4. Refresh UK official NATS AIRAC zones
echo   5. Refresh Sweden official LFV WFS layers
echo   6. Discover endpoints on an official public page
echo   7. Inspect a known public WMS endpoint
echo   8. Validate the 37-country source registry
echo   9. Audit downloaded GeoJSON geometry
echo   10. Build and test the website
echo   11. Open the exports folder
echo   0. Exit
echo.
set /p choice=Choose an option: 
if "%choice%"=="1" goto spain
if "%choice%"=="2" goto luxembourg
if "%choice%"=="3" goto ireland
if "%choice%"=="4" goto uk
if "%choice%"=="5" goto sweden
if "%choice%"=="6" goto discover
if "%choice%"=="7" goto wms
if "%choice%"=="8" goto validate
if "%choice%"=="9" goto audit
if "%choice%"=="10" goto build
if "%choice%"=="11" start "" "%cd%\exports" & goto menu
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

:ireland
python pipeline\main.py update-ireland
goto done

:uk
echo NATS KML is a visualization aid. Check the UK AIP and current NOTAMs.
python pipeline\main.py update-uk
goto done

:sweden
echo LFV data is CC BY-NC-ND 4.0 and for non-commercial use.
python pipeline\main.py update-sweden
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

:audit
python pipeline\validate_geojson.py "public\data\zones\*.geojson" "public\data\zones\sweden\*.geojson"
goto done

:build
call npm.cmd run build
goto done

:done
echo.
if errorlevel 1 (echo FAILED - read the message above.) else (echo Finished successfully.)
pause
goto menu
