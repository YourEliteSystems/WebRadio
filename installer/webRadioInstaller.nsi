;--------------------------------
; WebRadio Installer
;--------------------------------
; Name der Anwendung
OutFile "dist/WebRadioSetup.exe"
; Installationsverzeichnis (Standard)
InstallDir "$PROGRAMFILES\WebRadio"
; Standard-UI
Page directory
Page instfiles
; Verzeichnisse und Dateien
Section "Install WebRadio"
  ; Erstelle Zielverzeichnis
  SetOutPath "$INSTDIR"
  ; Kopiere alle Dateien aus build/
  File /r "build\*.*"
  ; Optional: Verknüpfung auf Desktop erstellen
  CreateShortCut "$DESKTOP\WebRadio.lnk" "$INSTDIR\WebRadio.exe"
SectionEnd
;--------------------------------
; Deinstallation
;--------------------------------
Section "Uninstall"
  Delete "$INSTDIR\WebRadio.exe"
  Delete "$DESKTOP\WebRadio.lnk"
  RMDir /r "$INSTDIR"
SectionEnd