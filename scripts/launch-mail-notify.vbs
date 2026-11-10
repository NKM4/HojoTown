Option Explicit
Dim shell, result
Set shell = CreateObject("WScript.Shell")
result = shell.Run("""C:\Program Files\nodejs\node.exe"" ""C:\Users\NKM\Projects\HojoTown\scripts\mac-mail-notify.cjs""", 0, True)
WScript.Quit result
