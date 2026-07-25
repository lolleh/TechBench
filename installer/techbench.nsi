; TechBench NSIS Installer Script
; Builds a Windows Setup.exe with Tauri's NSIS bundling
;
; This script is used by Tauri when building with:
;   npm run tauri build -- --bundles nsis
;
; Tauri auto-generates most of this. This file is provided as a
; reference for custom NSIS options in tauri.conf.json.

!include "MUI2.nsh"

Name "TechBench"
OutFile "TechBench-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\TechBench"
RequestExecutionLevel admin

; --- Version Info ---
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "TechBench"
VIAddVersionKey "CompanyName" "TechBench Team"
VIAddVersionKey "FileDescription" "Electronics Engineering & Mobile Device Servicing Platform"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "MIT License"

; --- MUI Settings ---
!define MUI_ABORTWARNING
!define MUI_ICON "..\gui\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\gui\src-tauri\icons\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\gui\src-tauri\icons\128x128.png"
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\gui\src-tauri\icons\128x128@2x.png"

; --- Welcome Page ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; --- Uninstaller Pages ---
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --- Languages ---
!insertmacro MUI_LANGUAGE "English"

; --- Installer Sections ---
Section "TechBench (Required)" SecMain
    SectionIn RO

    SetOutPath "$INSTDIR"

    ; Main executable
    File "..\gui\src-tauri\target\release\techbench.exe"

    ; Frontend assets
    SetOutPath "$INSTDIR\gui"
    File /r "..\gui\dist\*.*"

    ; Python modules
    SetOutPath "$INSTDIR\python"
    File /r "..\ai\*.*"
    File /r "..\database\*.*"
    SetOutPath "$INSTDIR\python\detection"
    File /r "..\detection\usb-scanner\*.*"
    SetOutPath "$INSTDIR\python\detection\chipset-id"
    File "..\detection\chipset-id\database.json"

    ; Rust binaries (if built)
    IfFileExists "..\hal\target\release\hal-cli.exe" 0 +2
        File /oname=hal-cli.exe "..\hal\target\release\hal-cli.exe"

    ; Scripts
    SetOutPath "$INSTDIR\scripts"
    File /oname=install-deps.bat "..\scripts\install-windows-deps.bat"

    ; Create data directories
    CreateDirectory "$APPDATA\TechBench"
    CreateDirectory "$APPDATA\TechBench\databases"
    CreateDirectory "$APPDATA\TechBench\projects"
    CreateDirectory "$APPDATA\TechBench\firmware"
    CreateDirectory "$APPDATA\TechBench\schematics"
    CreateDirectory "$APPDATA\TechBench\workspaces"
    CreateDirectory "$APPDATA\TechBench\logs"

    ; Initialize database
    DetailPrint "Initializing database..."
    nsExec::ExecToLog 'python -m pip install --quiet sqlite-utils'
    nsExec::ExecToLog 'python "$INSTDIR\scripts\init-db.py"'

    ; Create Start Menu shortcuts
    CreateDirectory "$SMPROGRAMS\TechBench"
    CreateShortCut "$SMPROGRAMS\TechBench\TechBench.lnk" "$INSTDIR\techbench.exe"
    CreateShortCut "$SMPROGRAMS\TechBench\Uninstall.lnk" "$INSTDIR\uninstall.exe"

    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\TechBench.lnk" "$INSTDIR\techbench.exe"

    ; Registry - Add to PATH
    EnVar::AddValue "PATH" "$INSTDIR"

    ; Registry - Uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "DisplayName" "TechBench"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "Publisher" "TechBench Team"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "NoRepair" 1

    ; Estimate size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench" "EstimatedSize" "$0"
SectionEnd

Section "Desktop Shortcuts" SecDesktop
    CreateShortCut "$DESKTOP\TechBench.lnk" "$INSTDIR\techbench.exe"
SectionEnd

; --- Uninstaller Section ---
Section "Uninstall"
    ; Remove files
    RMDir /r "$INSTDIR"

    ; Remove Start Menu items
    RMDir /r "$SMPROGRAMS\TechBench"

    ; Remove desktop shortcut
    Delete "$DESKTOP\TechBench.lnk"

    ; Remove from PATH
    EnVar::RemoveValue "PATH" "$INSTDIR"

    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechBench"

    ; NOTE: User data in %APPDATA%\TechBench is NOT removed
    MessageBox MB_YESNO "Remove user data (projects, firmware, databases)?" IDNO SkipData
        RMDir /r "$APPDATA\TechBench"
    SkipData:
SectionEnd

; --- Callbacks ---
Function .onInit
    ; Check for Python
    nsExec::ExecToStack 'python --version'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_OK|MB_ICONWARNING "Python 3 is recommended but not found. Some features may not work.$\n$\nInstall Python from https://python.org"
    ${EndIf}

    ; Check for Docker
    nsExec::ExecToStack 'docker --version'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_YESNO|MB_ICONQUESTION "Docker Desktop is recommended for container support.$\n$\nWould you like to continue without Docker?" IDYES SkipDocker
            Abort
        SkipDocker:
    ${EndIf}

    ; Check for adb
    nsExec::ExecToStack 'adb version'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_YESNO|MB_ICONQUESTION "Android SDK Platform Tools (adb) not found.$\n$\nWould you like to continue without adb?" IDYES SkipAdb
            Abort
        SkipAdb:
    ${EndIf}
FunctionEnd
