@echo off
title LezzetKAT - Yayina Hazirla
rem ZIP ile indirilen proje git deposu degildir; EAS dosyalari .easignore kurallarina gore yukler.
set EAS_NO_VCS=1
cd /d "%~dp0"
if exist "lezzetkat-app\package.json" cd /d "%~dp0lezzetkat-app"

if not exist "package.json" (
  echo  [HATA] Uygulama klasoru bulunamadi. Bu dosyayi proje klasorunun icinden calistir.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo  [HATA] Node.js kurulu degil. https://nodejs.org adresinden LTS surumunu kur.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo  [UYARI] lezzetkat-app klasorunde .env dosyasi yok.
  echo  Supabase ayarlari olmadan uygulama DEMO modunda derlenir
  echo  ^(her telefonda ayri veri, gercek kullanicilar birbirini goremez^).
  echo  Rehber: README - "Canli mod: Supabase kurulumu".
  echo.
  choice /c EH /m "  Yine de devam edilsin mi? (E=Evet, H=Hayir)"
  if errorlevel 2 exit /b 1
)

if not exist "node_modules\" (
  echo  Gerekli paketler yukleniyor, birkac dakika surebilir...
  call npm install
  if errorlevel 1 (
    echo  [HATA] Paketler yuklenemedi.
    pause
    exit /b 1
  )
)

:menu
cls
echo.
echo  =====================================================
echo     LezzetKAT - Yayina Hazirla
echo  =====================================================
echo.
echo   1) Web sitesini hazirla  (gizlilik politikasi adresi icin)
echo   2) Android TEST surumu    (telefona kurulan APK)
echo   3) Google Play surumu     (Play Console'a yuklenecek AAB)
echo   4) Cikis
echo.
choice /c 1234 /n /m "  Seciminiz (1-4): "
if errorlevel 4 exit /b 0
if errorlevel 3 goto play
if errorlevel 2 goto apk
if errorlevel 1 goto web

:web
echo.
echo  Web sitesi hazirlaniyor...
call npx expo export -p web --clear
if errorlevel 1 goto hata
echo.
echo  TAMAM. "lezzetkat-app\dist" klasoru hazir.
echo  https://app.netlify.com/drop adresini ac ve "dist" klasorunu sayfaya surukle.
echo  Verilen adresin sonuna /legal/privacy ekleyerek gizlilik politikasini kontrol et.
start "" explorer "%cd%\dist"
pause
goto menu

:login
call npx eas-cli@latest whoami >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Expo hesabina giris yap ^(hesabin yoksa https://expo.dev adresinden ucretsiz ac^):
  call npx eas-cli@latest login
  if errorlevel 1 exit /b 1
)
findstr /c:"projectId" app.json >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Proje Expo hesabina baglaniyor. Sorulan sorulara Enter / Y ile devam et.
  call npx eas-cli@latest init
  if errorlevel 1 exit /b 1
)
exit /b 0

:apk
call :login
if errorlevel 1 goto hata
echo.
echo  Android TEST surumu bulutta derleniyor ^(10-20 dakika^).
echo  Ilk seferde "Generate a new Android Keystore?" sorusuna Y de.
call npx eas-cli@latest build --platform android --profile preview
if errorlevel 1 goto hata
echo.
echo  TAMAM. Yukarida verilen baglantiyi Android telefonda acip APK'yi indir ve kur.
pause
goto menu

:play
call :login
if errorlevel 1 goto hata
echo.
echo  Google Play surumu bulutta derleniyor ^(10-20 dakika^).
echo  Ilk seferde "Generate a new Android Keystore?" sorusuna Y de.
call npx eas-cli@latest build --platform android --profile production
if errorlevel 1 goto hata
echo.
echo  TAMAM. Yukarida verilen baglantidan .aab dosyasini indir
echo  ve Google Play Console'da "Kapali test" surumu olarak yukle.
pause
goto menu

:hata
echo.
echo  [HATA] Islem tamamlanamadi. Yukaridaki mesaji kopyalayip bana gonderebilirsin.
pause
goto menu
