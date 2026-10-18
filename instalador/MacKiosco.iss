; ============================================================
;  MacKiosco - Instalador para Windows (Inno Setup 6)
;
;  No se compila a mano: usar "npm run instalador" desde la raiz del proyecto,
;  que prepara la carpeta "paquete" y despues llama a este script.
;
;  El mismo instalador sirve para INSTALAR en una PC nueva y para ACTUALIZAR
;  una PC que ya lo tiene (conserva todos los datos del local).
;
;  Instalacion desatendida (pruebas o instalaciones en serie):
;    Instalar-MacKiosco.exe /VERYSILENT /NOMBRE="Kiosco Don Pepe" /CLAVE=secreta1 /CATALOGO=1 /RED=1
; ============================================================

#ifndef VersionApp
  #define VersionApp "1.0.0"
#endif
#define NombreApp "MacKiosco"

[Setup]
AppId={{6F2B8C1E-4D7A-4B0E-9A53-MACKIOSCO001}
AppName={#NombreApp}
AppVersion={#VersionApp}
AppVerName={#NombreApp} {#VersionApp}
AppPublisher={#NombreApp}
DefaultDirName={autopf}\{#NombreApp}
DefaultGroupName={#NombreApp}
DisableProgramGroupPage=yes
DisableDirPage=auto
UsePreviousAppDir=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=salida
OutputBaseFilename=Instalar-{#NombreApp}
SetupIconFile=recursos\mackiosco.ico
UninstallDisplayIcon={app}\mackiosco.ico
UninstallDisplayName={#NombreApp}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=no
VersionInfoVersion={#VersionApp}
VersionInfoProductName={#NombreApp}
VersionInfoDescription=Instalador de {#NombreApp} - Sistema de gestion para kioscos

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; La aplicacion y Node.js se reemplazan siempre (asi funciona la actualizacion).
Source: "paquete\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "paquete\runtime\node\*"; DestDir: "{app}\runtime\node"; Flags: ignoreversion
Source: "paquete\instalador\*"; DestDir: "{app}\instalador"; Flags: ignoreversion
Source: "paquete\herramientas\*"; DestDir: "{app}\herramientas"; Flags: ignoreversion
Source: "paquete\mackiosco.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "paquete\LICENCIAS-DE-TERCEROS.txt"; DestDir: "{app}"; Flags: ignoreversion
; MySQL queda funcionando durante una actualizacion: sus archivos solo se copian la primera vez.
Source: "paquete\runtime\mysql\*"; DestDir: "{app}\runtime\mysql"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\{code:NombreDelAcceso}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\instalador\abrir.vbs"""; IconFilename: "{app}\mackiosco.ico"; Comment: "Abrir el sistema de gestion"
Name: "{group}\Abrir {#NombreApp}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\instalador\abrir.vbs"""; IconFilename: "{app}\mackiosco.ico"
Name: "{group}\Herramientas\Reiniciar {#NombreApp}"; Filename: "{app}\herramientas\Reiniciar MacKiosco.bat"
Name: "{group}\Herramientas\Restaurar copia de seguridad"; Filename: "{app}\herramientas\Restaurar copia de seguridad.bat"
Name: "{group}\Herramientas\Carpeta de datos y copias"; Filename: "{commonappdata}\{#NombreApp}"

[Registry]
; Se recuerda el nombre del acceso directo para volver a crearlo igual en las actualizaciones.
Root: HKLM64; Subkey: "SOFTWARE\MacKiosco"; ValueType: string; ValueName: "NombreAcceso"; ValueData: "{code:NombreDelAcceso}"; Check: EsInstalacionNueva

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\instalador\abrir.vbs"""; Description: "Abrir {#NombreApp} ahora"; Flags: postinstall nowait skipifsilent runasoriginaluser; Check: ConfiguracionCorrecta

[UninstallRun]
Filename: "{app}\runtime\node\node.exe"; Parameters: """{app}\instalador\desinstalar.js"""; Flags: runhidden waituntilterminated; RunOnceId: "QuitarServiciosMacKiosco"

[Code]
var
  PaginaNombre: TInputQueryWizardPage;
  PaginaClave: TInputQueryWizardPage;
  PaginaDatos: TInputOptionWizardPage;
  PaginaRed: TInputOptionWizardPage;
  EsActualizacion: Boolean;
  ConfiguracionFallida: Boolean;

{ Una PC ya instalada tiene el archivo de instalacion marcado como completo. }
function YaEstaInstalado: Boolean;
var
  Contenido: AnsiString;
begin
  Result := False;
  if LoadStringFromFile(ExpandConstant('{commonappdata}\MacKiosco\config\instalacion.json'), Contenido) then
    Result := Pos('"completa": true', String(Contenido)) > 0;
end;

function EsInstalacionNueva: Boolean;
begin
  Result := not EsActualizacion;
end;

function ConfiguracionCorrecta: Boolean;
begin
  Result := not ConfiguracionFallida;
end;

{ El nombre del kiosco se usa como nombre del acceso directo: se quitan los caracteres que Windows no acepta. }
function NombreDelAcceso(Param: String): String;
var
  I: Integer;
begin
  Result := '';
  if EsActualizacion then
    RegQueryStringValue(HKLM64, 'SOFTWARE\MacKiosco', 'NombreAcceso', Result)
  else
    Result := Trim(PaginaNombre.Values[0]);
  for I := 1 to Length(Result) do
    if Pos(Result[I], '\/:*?"<>|') > 0 then
      Result[I] := ' ';
  Result := Trim(Result);
  if Result = '' then
    Result := 'MacKiosco';
end;

function TextoJson(Valor: String): String;
begin
  Result := Valor;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
end;

function BooleanoJson(Valor: Boolean): String;
begin
  if Valor then
    Result := 'true'
  else
    Result := 'false';
end;

procedure InitializeWizard;
begin
  EsActualizacion := YaEstaInstalado;
  ConfiguracionFallida := False;

  PaginaNombre := CreateInputQueryPage(wpSelectDir,
    'Nombre del kiosco',
    'Como se llama el local donde se instala el sistema?',
    'Este nombre se muestra en la pantalla de ingreso, en el menu, en los tickets y en el acceso directo del escritorio. Se puede cambiar despues desde Configuracion.');
  PaginaNombre.Add('Nombre del kiosco:', False);
  PaginaNombre.Values[0] := ExpandConstant('{param:NOMBRE|MacKiosco}');

  PaginaClave := CreateInputQueryPage(PaginaNombre.ID,
    'Usuario administrador',
    'Elegi la clave del administrador del sistema',
    'El usuario administrador se llama "admin". Escribi una clave de al menos 6 caracteres y guardala en un lugar seguro: es la que da acceso a todo el sistema.');
  PaginaClave.Add('Clave del usuario admin:', True);
  PaginaClave.Add('Repetir la clave:', True);
  PaginaClave.Values[0] := ExpandConstant('{param:CLAVE|}');
  PaginaClave.Values[1] := ExpandConstant('{param:CLAVE|}');

  PaginaDatos := CreateInputOptionPage(PaginaClave.ID,
    'Datos iniciales',
    'Con que productos arranca este local?',
    'Las categorias y los metodos de pago se cargan siempre. Los productos se pueden editar, agregar o borrar despues.',
    True, False);
  PaginaDatos.Add('Cargar el catalogo de ejemplo (174 productos tipicos de kiosco, con precios de referencia y sin stock)');
  PaginaDatos.Add('Empezar sin productos (se cargan a mano)');
  if ExpandConstant('{param:CATALOGO|1}') = '0' then
    PaginaDatos.SelectedValueIndex := 1
  else
    PaginaDatos.SelectedValueIndex := 0;

  PaginaRed := CreateInputOptionPage(PaginaDatos.ID,
    'Uso en la red del local',
    'Se va a usar desde mas de un equipo?',
    'Si se activa, otras computadoras, tablets o celulares conectados a la red del local pueden usar el sistema entrando con el navegador a la direccion de esta PC. Si el sistema se usa solo en esta computadora, se puede dejar desactivado.',
    False, False);
  PaginaRed.Add('Permitir el uso desde otros equipos de la red del local');
  PaginaRed.Values[0] := ExpandConstant('{param:RED|1}') <> '0';
end;

{ En una actualizacion no se pregunta nada: se conserva todo lo que ya tiene el local. }
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := EsActualizacion and
    ((PageID = PaginaNombre.ID) or (PageID = PaginaClave.ID) or (PageID = PaginaDatos.ID) or (PageID = PaginaRed.ID));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if EsActualizacion then
    exit;

  if CurPageID = PaginaNombre.ID then
  begin
    if Trim(PaginaNombre.Values[0]) = '' then
    begin
      MsgBox('Escribi el nombre del kiosco.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = PaginaClave.ID then
  begin
    if Length(PaginaClave.Values[0]) < 6 then
    begin
      MsgBox('La clave debe tener al menos 6 caracteres.', mbError, MB_OK);
      Result := False;
    end
    else if PaginaClave.Values[0] <> PaginaClave.Values[1] then
    begin
      MsgBox('Las dos claves no coinciden. Escribilas de nuevo.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

{ Antes de reemplazar archivos en una actualizacion se detiene el sistema (la base de datos sigue funcionando). }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
begin
  Result := '';
  if EsActualizacion then
  begin
    Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN MacKiosco', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
    Sleep(3000);
  end;
end;

function LeerUltimoError: String;
var
  Lineas: TArrayOfString;
  I: Integer;
begin
  Result := '';
  if LoadStringsFromFile(ExpandConstant('{commonappdata}\MacKiosco\logs\ultimo-error.txt'), Lineas) then
    for I := 0 to GetArrayLength(Lineas) - 1 do
      Result := Result + Lineas[I] + #13#10;
end;

{ Con los archivos ya copiados, se configura la base de datos, las claves de esta PC y el arranque automatico. }
procedure CurStepChanged(CurStep: TSetupStep);
var
  ArchivoRespuestas, Json, Parametros: String;
  Codigo: Integer;
begin
  if CurStep <> ssPostInstall then
    exit;

  ArchivoRespuestas := ExpandConstant('{tmp}\respuestas.json');
  Json := '{' +
    '"nombre_comercio":"' + TextoJson(Trim(PaginaNombre.Values[0])) + '",' +
    '"admin_password":"' + TextoJson(PaginaClave.Values[0]) + '",' +
    '"con_catalogo":' + BooleanoJson(PaginaDatos.SelectedValueIndex = 0) + ',' +
    '"permitir_red":' + BooleanoJson(PaginaRed.Values[0]) +
    '}';
  SaveStringsToUTF8File(ArchivoRespuestas, [Json], False);

  WizardForm.StatusLabel.Caption := 'Preparando la base de datos y el arranque automatico. Puede tardar uno o dos minutos...';
  WizardForm.FilenameLabel.Caption := '';
  WizardForm.Refresh;

  Parametros := '"' + ExpandConstant('{app}\instalador\configurar.js') + '" --respuestas "' + ArchivoRespuestas + '"';
  if not Exec(ExpandConstant('{app}\runtime\node\node.exe'), Parametros, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Codigo) then
    Codigo := -1;
  DeleteFile(ArchivoRespuestas);

  if Codigo <> 0 then
  begin
    ConfiguracionFallida := True;
    MsgBox('Los archivos se copiaron, pero no se pudo terminar de configurar el sistema.' + #13#10#13#10 +
      LeerUltimoError + #13#10 +
      'Podes volver a ejecutar este instalador para reintentar. El detalle completo esta en:' + #13#10 +
      ExpandConstant('{commonappdata}\MacKiosco\logs\instalacion.log'), mbError, MB_OK);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and ConfiguracionFallida then
  begin
    WizardForm.FinishedHeadingLabel.Caption := 'La instalacion quedo incompleta';
    WizardForm.FinishedLabel.Caption := 'No se pudo terminar de configurar MacKiosco en este equipo. Volve a ejecutar el instalador para reintentar o consulta a tu proveedor.';
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox('MacKiosco se desinstalo.' + #13#10#13#10 +
      'Los datos del local (ventas, productos, copias de seguridad y configuracion) NO se borraron. Quedaron en:' + #13#10 +
      ExpandConstant('{commonappdata}\MacKiosco') + #13#10#13#10 +
      'Si se vuelve a instalar MacKiosco en esta PC, se recuperan automaticamente.', mbInformation, MB_OK);
end;
