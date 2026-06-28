; Inno Setup script — compile with Inno Setup 6+ (https://jrsoftware.org/isinfo.php)

#define AppName "Job Application Tool"
#define AppVersion "1.0"
#define AppPublisher "Aleeza Hashmi"
#define AppURL "https://github.com/aleezah/Aleeza-s-Resume-Builder"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputDir=installer-output
OutputBaseFilename=ResumeBuilder-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checked

[Files]
; App source — exclude database, uploads, outputs, node_modules, and git
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; \
  Excludes: "node_modules\*,client\node_modules\*,uploads\*,outputs\*,data.db,*.db-shm,*.db-wal,.git\*,installer-output\*,*.iss"

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Install npm dependencies after copying files
Filename: "cmd.exe"; Parameters: "/C npm run install:all"; WorkingDir: "{app}"; \
  StatusMsg: "Installing dependencies (this may take a minute)..."; \
  Flags: runhidden waituntilterminated

; Open the app after install
Filename: "{app}\start.bat"; Description: "Launch Job Application Tool now"; \
  Flags: nowait postinstall skipifsilent

[Code]
// Check Node.js is installed before proceeding
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  if not Exec('cmd.exe', '/C where node', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
  begin
    if MsgBox('Node.js is required but not installed.' + #13#10 + #13#10 +
              'Click OK to open the Node.js download page, then re-run this installer after installing it.',
              mbError, MB_OKCANCEL) = IDOK then
      ShellExec('open', 'https://nodejs.org/en/download', '', '', SW_SHOW, ewNoWait, ResultCode);
    Result := False;
  end else
    Result := True;
end;
