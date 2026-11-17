@echo off
chcp 65001 >nul
title A&G CLOTHING - tienda publica
cd /d "%~dp0"

echo.
echo  ===============================================
echo   A&G CLOTHING - arrancar tienda con enlace publico
echo  ===============================================
echo.
echo  [1/2] Arrancando el servidor...
start "A&G servidor" cmd /k node server.js
timeout /t 5 >nul

echo  [2/2] Abriendo el tunel publico (Cloudflare)...
echo.
echo  Busca abajo la linea con  https://......trycloudflare.com
echo  Esa es la direccion que puedes pasar por WhatsApp.
echo  (Para cerrar la tienda: cierra esta ventana o pulsa Ctrl+C)
echo.

tools\cloudflared.exe tunnel --url http://localhost:3000

echo.
echo  Tunel cerrado. La tienda ya no es accesible desde internet.
pause
