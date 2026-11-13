param([Parameter(Mandatory=$true)][ValidateRange(1,12)][int]$Restaurant)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Windows.Forms
$credentialPath = Join-Path $env:LOCALAPPDATA ('Waffarly/local-pos-credentials/reference-restaurant-' + $Restaurant + '.json')
$credential = [System.IO.File]::ReadAllText($credentialPath) | ConvertFrom-Json
$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($credential.encryptedPassword), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  [System.Windows.Forms.Clipboard]::SetText([Text.Encoding]::UTF8.GetString($bytes))
  Write-Output ('Password copied for ' + $credential.slug + ' / ' + $credential.username + '. Paste into POS login and clear your clipboard afterwards.')
} finally { [Array]::Clear($bytes, 0, $bytes.Length) }
