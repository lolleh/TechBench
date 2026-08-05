' TechBench Auto-Start Launcher
' Runs the server silently in the background on Windows login.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
python = "python"
serverScript = appDir & "\server.py"

WshShell.CurrentDirectory = appDir
WshShell.Run """" & python & """ """ & serverScript & """", 0, False
