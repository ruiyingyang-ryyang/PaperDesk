Unicode true
!cd "${__FILEDIR__}"
!ifndef APP_VERSION
!error "APP_VERSION must be supplied by build-portable.cjs"
!endif
Name "PaperDesk"
OutFile "..\release\PaperDesk-Windows-x64-Portable.exe"
RequestExecutionLevel user
SetCompressor zlib
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow
Icon "..\assets\icon.ico"
!include "x64.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "PaperDesk requires 64-bit Windows."
    Abort
  ${EndIf}
FunctionEnd

Section "Run"
  StrCpy $INSTDIR "$LOCALAPPDATA\PaperDeskPortable\${APP_VERSION}"
  IfFileExists "$INSTDIR\.ready" launch extract
  extract:
    SetOutPath "$INSTDIR"
    SetOverwrite on
    File /r "..\dist\PaperDesk-win32-x64\*.*"
    FileOpen $1 "$INSTDIR\.ready" w
    FileWrite $1 "${APP_VERSION}"
    FileClose $1
  launch:
    ${GetParameters} $0
    SetOutPath "$INSTDIR"
    Exec '"$INSTDIR\PaperDesk.exe" $0'
SectionEnd
