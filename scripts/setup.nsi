Unicode true
!cd "${__FILEDIR__}"
Name "PaperDesk"
OutFile "..\release\PaperDesk-Windows-x64-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\PaperDesk"
RequestExecutionLevel user
SetCompressor zlib
BrandingText "PaperDesk"
SilentInstall silent
AutoCloseWindow true
Icon "..\assets\icon.ico"
UninstallIcon "..\assets\icon.ico"
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles
ShowInstDetails nevershow
ShowUninstDetails show
!include "x64.nsh"
!include "LogicLib.nsh"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "PaperDesk requires 64-bit Windows."
    Abort
  ${EndIf}
FunctionEnd

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "..\dist\PaperDesk-win32-x64\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\PaperDesk.lnk" "$INSTDIR\PaperDesk.exe" "" "$INSTDIR\resources\PaperDesk.ico" 0
  CreateShortCut "$SMPROGRAMS\PaperDesk.lnk" "$INSTDIR\PaperDesk.exe" "" "$INSTDIR\resources\PaperDesk.ico" 0
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "DisplayName" "PaperDesk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "DisplayVersion"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "Publisher" "PaperDesk contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "DisplayIcon" "$INSTDIR\PaperDesk.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk" "NoRepair" 1
  Exec '"$INSTDIR\PaperDesk.exe"'
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog '"$SYSDIR\schtasks.exe" /Delete /TN "PaperDesk-Friday-0800" /F'
  nsExec::ExecToLog '"$SYSDIR\schtasks.exe" /Delete /TN "PaperDesk-Weekly" /F'
  Delete "$DESKTOP\PaperDesk.lnk"
  Delete "$SMPROGRAMS\PaperDesk.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PaperDesk"
  RMDir /r "$INSTDIR"
  ; Keep %APPDATA%\PaperDesk: the user's research collection is not program code.
SectionEnd
