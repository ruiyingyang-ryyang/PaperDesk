!macro customUnInstall
  nsExec::ExecToLog '"$SYSDIR\schtasks.exe" /Delete /TN "PaperDesk-Friday-0800" /F'
  nsExec::ExecToLog '"$SYSDIR\schtasks.exe" /Delete /TN "PaperDesk-Weekly" /F'
!macroend
