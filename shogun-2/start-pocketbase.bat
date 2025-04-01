@echo off
echo === AVVIO POCKETBASE ===
echo Avvio PocketBase con configurazione predefinita per Shogun Music

REM Interrompi eventuali processi PocketBase esistenti
taskkill /f /im pocketbase.exe 2>nul

REM Imposta le variabili con i dati di configurazione
set "PB_ADMIN_EMAIL=admin@example.com"
set "PB_ADMIN_PASSWORD=password123"

REM Verifica se la directory pb_data esiste già
if not exist "D:\pb_data" (
    echo Creo directory per PocketBase...
    mkdir "D:\pb_data"
)

echo Avvio PocketBase...
start "" "D:\pocketbase.exe" serve --http="127.0.0.1:8090" --dir="D:\pb_data"

echo PocketBase avviato sul localhost:8090
echo Attend 3 secondi...
timeout /t 3 >nul

echo Per accedere all'Admin UI vai a: http://127.0.0.1:8090/_/
echo Email: %PB_ADMIN_EMAIL%
echo Password: %PB_ADMIN_PASSWORD%
echo ============================

echo Premi un tasto per chiudere questa finestra...
pause > nul 