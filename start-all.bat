@echo off
echo === SHOGUN MUSIC - AVVIO COMPLETO ===
echo.
echo Questo script avviera' sia PocketBase che il server Shogun Music
echo.

:: Verifica se i percorsi esistono
if not exist "pocketbase" (
    echo [ERRORE] Directory pocketbase non trovata!
    echo Assicurati di eseguire questo script dalla root del progetto
    goto :error
)

if not exist "shogun-music" (
    echo [ERRORE] Directory shogun-music non trovata!
    echo Assicurati di eseguire questo script dalla root del progetto
    goto :error
)

:: Avvia PocketBase in background
echo Avvio di PocketBase...
start cmd /c "cd pocketbase && start-pocketbase.bat"

:: Attendi 2 secondi per assicurarsi che PocketBase sia avviato
timeout /t 2 /nobreak > nul

:: Avvia il server Shogun Music
echo Avvio del server Shogun Music...
cd shogun-music && npm run dev

goto :eof

:error
echo.
echo Esecuzione terminata con errori.
pause
exit /b 1 