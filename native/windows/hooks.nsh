!macro KillFleetProcesses
  DetailPrint "Stopping discord MCP processes..."
  ExecWait 'taskkill /F /IM discord-backend.exe /T' $0
  ExecWait 'taskkill /F /IM discord-native.exe /T' $0
  !if "${INSTALLMODE}" == "currentUser"
    nsis_tauri_utils::KillProcessCurrentUser "discord-backend.exe"
    Pop $0
    nsis_tauri_utils::KillProcessCurrentUser "discord-native.exe"
    Pop $0
  !else
    nsis_tauri_utils::KillProcess "discord-backend.exe"
    Pop $0
    nsis_tauri_utils::KillProcess "discord-native.exe"
    Pop $0
  !endif
  Sleep 2000
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro KillFleetProcesses
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillFleetProcesses
!macroend
