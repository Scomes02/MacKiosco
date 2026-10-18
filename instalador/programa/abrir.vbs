' ============================================================
'  MacKiosco - Abre el sistema (acceso directo del escritorio)
'  Espera a que el servidor este listo y lo abre en una ventana
'  propia, sin barra de direcciones (Edge o Chrome). Si no hay
'  ninguno de los dos, usa el navegador predeterminado.
' ============================================================
Option Explicit

Dim shell, fso, puerto, direccion, intento, listo
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

puerto = "3001"
Dim archivoPuerto
archivoPuerto = shell.ExpandEnvironmentStrings("%ProgramData%") & "\MacKiosco\puerto.txt"
If fso.FileExists(archivoPuerto) Then
  Dim lector
  Set lector = fso.OpenTextFile(archivoPuerto, 1)
  If Not lector.AtEndOfStream Then puerto = Trim(lector.ReadLine)
  lector.Close
End If
direccion = "http://localhost:" & puerto

' Al encender la PC el servidor puede tardar unos segundos en estar listo.
listo = False
For intento = 1 To 45
  If ServidorResponde(direccion & "/api/salud") Then
    listo = True
    Exit For
  End If
  WScript.Sleep 1000
Next

If Not listo Then
  MsgBox "MacKiosco todavia no responde." & vbCrLf & vbCrLf & _
         "Si la computadora se acaba de encender, espera un minuto y volve a intentar." & vbCrLf & _
         "Si el problema sigue, reinicia la computadora o avisa a tu proveedor.", vbExclamation, "MacKiosco"
  WScript.Quit 1
End If

Dim navegador
navegador = BuscarNavegador()
If navegador <> "" Then
  shell.Run """" & navegador & """ --app=" & direccion & " --start-maximized", 1, False
Else
  shell.Run direccion, 1, False
End If

Function ServidorResponde(url)
  On Error Resume Next
  Dim pedido
  Set pedido = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  pedido.setTimeouts 1000, 1000, 2000, 2000
  pedido.Open "GET", url, False
  pedido.Send
  ServidorResponde = (Err.Number = 0 And pedido.Status = 200)
  On Error GoTo 0
End Function

Function BuscarNavegador()
  Dim candidatos, ruta
  candidatos = Array( _
    "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe", _
    "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe", _
    "%ProgramFiles%\Google\Chrome\Application\chrome.exe", _
    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe", _
    "%LocalAppData%\Google\Chrome\Application\chrome.exe")
  BuscarNavegador = ""
  For Each ruta In candidatos
    ruta = shell.ExpandEnvironmentStrings(ruta)
    If fso.FileExists(ruta) Then
      BuscarNavegador = ruta
      Exit Function
    End If
  Next
End Function
