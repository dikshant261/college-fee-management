; Inno Setup Script for College Fee Management System
#define MyAppName "College Fee Management"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "College Administration"
#define MyAppURL "http://localhost:5000"
#define MyAppExeName "CollegeFeeManagement.exe"

[Setup]
AppId={{5A4F9E82-9B7E-4E65-BF61-94B6D87A04E2}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=d:\clg-app\installer_output
OutputBaseFilename=CollegeFeeManagement-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
ChangesEnvironment=yes
DisableDirPage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "d:\clg-app\installer_build\staging\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\{#MyAppName}\Stop {#MyAppName}"; Filename: "{app}\StopCollegeApp.exe"
Name: "{autoprograms}\{#MyAppName}\Open Data Folder"; Filename: "explorer.exe"; Parameters: """{code:GetDataDir}"""
Name: "{autoprograms}\{#MyAppName}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Silently configure Windows Firewall for port 5000 so all devices on Wi-Fi connect seamlessly
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""College App Server (5000)"" dir=in action=allow protocol=TCP localport=5000 profile=any"; Flags: runhidden
; Option to launch the application immediately
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName} now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Silently stop server if running
Filename: "{app}\StopCollegeApp.exe"; Flags: runhidden
; Silently remove Firewall rule
Filename: "netsh.exe"; Parameters: "advfirewall firewall delete rule name=""College App Server (5000)"""; Flags: runhidden

[Code]
var
  DataDirPage: TInputDirWizardPage;

procedure InitializeWizard;
begin
  DataDirPage := CreateInputDirPage(
    wpSelectDir,
    'Database & Storage Location',
    'Where should the database (college.db) and uploads folder be stored?',
    'Choose the directory where student records, payment logs, photos, and QR codes will be saved.'#13#10#13#10 +
    'Important: This folder will NEVER be deleted if you uninstall or upgrade the app, keeping your college records safe.',
    False,
    '');
  DataDirPage.Add('College Data Folder:');
  DataDirPage.Values[0] := 'C:\CollegeData';
end;

function GetDataDir(Param: String): String;
var
  Dir: String;
begin
  Dir := Trim(DataDirPage.Values[0]);
  if Dir = '' then
    Result := 'C:\CollegeData'
  else
    Result := Dir;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  DataDir, DBPath, UploadsDir, StudentsDir, QrcodesDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    DataDir := GetDataDir('');
    DBPath := DataDir + '\college.db';
    UploadsDir := DataDir + '\uploads';
    StudentsDir := UploadsDir + '\students';
    QrcodesDir := UploadsDir + '\qrcodes';

    // 1. Create folders
    ForceDirectories(DataDir);
    ForceDirectories(UploadsDir);
    ForceDirectories(StudentsDir);
    ForceDirectories(QrcodesDir);

    // 2. Set permanent Windows System Environment Variables
    RegWriteStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'DATABASE_PATH', DBPath);
    RegWriteStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'UPLOADS_DIR', UploadsDir);
    RegWriteStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'PORT', '5000');
    RegWriteStringValue(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'HOST', '0.0.0.0');
  end;
end;
