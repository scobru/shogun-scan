@echo off
echo === AVVIO POCKETBASE ===
echo Scaricamento PocketBase...

:: Verifica se PocketBase è già stato scaricato
if not exist pocketbase.exe (
    echo PocketBase non trovato, scaricamento in corso...
    :: Scarica PocketBase (Windows 64-bit)
    curl -L -o pocketbase.zip https://github.com/pocketbase/pocketbase/releases/download/v0.26.2/pocketbase_0.26.2_windows_amd64.zip
    echo Estrazione archivio...
    :: Estrai l'archivio
    powershell -Command "Expand-Archive -Path pocketbase.zip -DestinationPath . -Force"
    echo Pulizia file temporanei...
    :: Elimina l'archivio
    del pocketbase.zip
    echo PocketBase pronto!
) else (
    echo PocketBase già scaricato.
)

echo.
echo Avvio server PocketBase sulla porta 8090...
echo Per accedere all'interfaccia admin visita: http://127.0.0.1:8090/_/
echo Per terminare il server premere CTRL+C
echo.

:: Avvia PocketBase
pocketbase.exe serve

echo PocketBase terminato. 