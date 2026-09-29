@echo off
title LezzetKAT
cd /d "%~dp0"
if exist "lezzetkat-app\package.json" cd /d "%~dp0lezzetkat-app"

echo.
echo  =============================================
echo     LezzetKAT baslatiliyor...
echo  =============================================
echo.

if not exist "package.json" (
  echo  [HATA] Uygulama klasoru bulunamadi.
  echo  Bu dosyayi ZIP'ten cikardigin klasorun icinden calistir.
  echo  ZIP'in icinden dogrudan acma: once "Tumunu ayikla" de.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo  [HATA] Node.js kurulu degil.
  echo  https://nodejs.org adresinden LTS surumunu kur,
  echo  bilgisayari yeniden baslat ve bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  [1/2] Gerekli paketler yukleniyor. Ilk seferde birkac dakika surer...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [HATA] Paketler yuklenemedi. Internet baglantini kontrol edip tekrar dene.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  [2/2] Uygulama baslatiliyor. Birazdan asagida bir QR kod cikacak.
echo.
echo   - iPhone: Kamera ile QR kodu okut, "Expo Go'da ac" bildirimine dokun.
echo   - Android: Expo Go uygulamasini ac, "Scan QR code" ile okut.
echo   - Kapatmak icin bu pencereyi kapat.
echo.
call npx expo start --tunnel --clear
echo.
pause
