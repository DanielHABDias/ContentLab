Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
scriptPath = fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "iniciar.bat")
command = "cmd.exe /c """ & scriptPath & """"
shell.Run command, 0, False
