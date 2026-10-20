@echo off
rem Startet einmalig einen lokalen Server und oeffnet Stundenzettel unter http://localhost:8765/
rem In Stundenzettel dann auf "Installieren" klicken (Startbildschirm oder Einstellungen > Allgemein).
rem Danach braucht die App diesen Server nicht mehr. Es wird nichts installiert und nichts ausserhalb dieses Ordners veraendert.
cd /d "%~dp0"
echo.
echo  Naechster Schritt: Im Browser auf "Installieren" klicken. Danach dieses Fenster schliessen.
echo.

rem 1) Python nutzen, falls wirklich vorhanden (der Windows-Store-Platzhalter zaehlt nicht).
python -c "import http.server" >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:8765/index.html"
  python -m http.server 8765 --bind 127.0.0.1
  goto :eof
)
py -3 -c "import http.server" >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:8765/index.html"
  py -3 -m http.server 8765 --bind 127.0.0.1
  goto :eof
)

rem 2) Sonst das in Windows enthaltene PowerShell nutzen (kein Python noetig).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if %errorlevel% neq 0 (
  echo.
  echo  Der lokale Server konnte nicht gestartet werden - vermutlich blockiert durch die Sicherheitssoftware.
  echo  Du kannst Stundenzettel.html weiterhin ganz normal per Doppelklick nutzen.
  pause
)
