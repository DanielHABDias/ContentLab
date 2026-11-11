Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
scriptPath = fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "iniciar.bat")
command = "cmd.exe /c """ & scriptPath & """"
' Show installer progress and errors; the console closes once the server opens.
shell.Run command, 1, False
