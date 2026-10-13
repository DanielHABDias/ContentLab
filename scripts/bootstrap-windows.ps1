# Content Lab bootstrap for Windows 10/11 (PowerShell 5.1+).
# Everything is installed into .tools; no registry, PATH persistence or admin needed.
param()
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tools = Join-Path $root ".tools"
$nodeVersion = "22.16.0"
$env:PATH = "$tools\node;$tools\ffmpeg;$tools\whisper;$env:PATH"
New-Item -ItemType Directory -Force -Path $tools | Out-Null

function Log([string]$message) { Write-Host "[Content Lab] $message" }
function Fail([string]$message) { throw "[Content Lab] $message" }
function Fetch([string]$url,[string]$destination) {
  $parent = Split-Path -Parent $destination
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Log "Baixando: $url"
  Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing -MaximumRedirection 8
}
function Verify-Hash([string]$file,[string]$expected) {
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash -ine $expected) {
    Fail "Falha na verificação SHA256 do arquivo $file"
  }
}
function Verify-Manifest([string]$archive,[string]$manifest,[string]$name) {
  $matched = @(Get-Content -LiteralPath $manifest | Where-Object {
    $_ -match ('^[a-fA-F0-9]{64}\s+\*?' + [regex]::Escape($name) + '$')
  })
  if ($matched.Count -ne 1) { Fail "Checksum oficial não encontrado para $name." }
  Verify-Hash $archive (($matched[0] -split '\s+')[0])
}
function In-Temp([scriptblock]$action) {
  $temp = Join-Path $tools ("download-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  try { & $action $temp } finally { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
function Has-Node {
  try {
    $version = (& node --version 2>$null)
    $npmVersion = (& npm.cmd --version 2>$null)
    return (($version -match '^v(\d+)\.') -and ([int]$Matches[1] -ge 22) -and !!$npmVersion)
  } catch { return $false }
}
function Ensure-Node {
  if (Has-Node) { Log "Node.js e npm encontrados."; return }
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  $suffix = switch ($arch) { "X64" { "x64" } "Arm64" { "arm64" } default { Fail "Arquitetura Windows não suportada: $arch" } }
  $name = "node-v$nodeVersion-win-$suffix.zip"
  $base = "https://nodejs.org/dist/v$nodeVersion"
  In-Temp {
    param($temp)
    Log "Instalando Node.js $nodeVersion localmente..."
    Fetch "$base/SHASUMS256.txt" (Join-Path $temp "SHASUMS256.txt")
    $archive = Join-Path $temp $name
    Fetch "$base/$name" $archive
    Verify-Manifest $archive (Join-Path $temp "SHASUMS256.txt") $name
    Expand-Archive -LiteralPath $archive -DestinationPath $temp -Force
    $source = Join-Path $temp "node-v$nodeVersion-win-$suffix"
    if (!(Test-Path (Join-Path $source "npm.cmd"))) { Fail "Pacote do Node incompleto." }
    $target = Join-Path $tools "node"
    if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    Move-Item -LiteralPath $source -Destination $target
  }
  if (!(Has-Node)) { Fail "Node/npm não disponíveis depois da instalação." }
}
function Has-FFmpeg {
  try { return (!!(Get-Command ffmpeg.exe -ErrorAction Stop) -and !!(Get-Command ffprobe.exe -ErrorAction Stop)) }
  catch { return $false }
}
function Ensure-FFmpeg {
  if (Has-FFmpeg) { Log "FFmpeg/FFprobe encontrados."; return }
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  $suffix = switch ($arch) { "X64" { "win64" } "Arm64" { "winarm64" } default { Fail "Arquitetura Windows não suportada: $arch" } }
  $name = "ffmpeg-master-latest-$suffix-gpl.zip"
  $base = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"
  In-Temp {
    param($temp)
    Log "Instalando FFmpeg/FFprobe portáteis..."
    Fetch "$base/checksums.sha256" (Join-Path $temp "checksums.sha256")
    $archive = Join-Path $temp $name
    Fetch "$base/$name" $archive
    Verify-Manifest $archive (Join-Path $temp "checksums.sha256") $name
    $unpack = Join-Path $temp "unpacked"
    Expand-Archive -LiteralPath $archive -DestinationPath $unpack
    $exe = Get-ChildItem -LiteralPath $unpack -Filter "ffmpeg.exe" -File -Recurse | Select-Object -First 1
    if (!$exe -or !(Test-Path (Join-Path $exe.DirectoryName "ffprobe.exe"))) { Fail "Binários do FFmpeg não encontrados no download." }
    $target = Join-Path $tools "ffmpeg"
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $target "ffmpeg.exe") -Force
    Copy-Item -LiteralPath (Join-Path $exe.DirectoryName "ffprobe.exe") -Destination (Join-Path $target "ffprobe.exe") -Force
  }
  if (!(Has-FFmpeg)) { Fail "FFmpeg não pôde ser instalado." }
}
function Has-Whisper {
  $configured = $env:CONTENTLAB_WHISPER_CLI
  if (!$configured) { $configured = "whisper-cli.exe" }
  return !!(Get-Command $configured -ErrorAction SilentlyContinue)
}
function Ensure-Whisper {
  if (Has-Whisper) { Log "whisper-cli encontrado."; return }
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  $suffix = switch ($arch) { "X64" { "x64" } "Arm64" { "arm64" } default { Fail "Arquitetura não suportada: $arch" } }
  $name = "whisper-bin-win-cpu-$suffix.zip"
  In-Temp {
    param($temp)
    Log "Instalando whisper.cpp CPU (v1.9.4)..."
    $archive = Join-Path $temp $name
    Fetch "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.4/$name" $archive
    $unpack = Join-Path $temp "unpacked"
    Expand-Archive -LiteralPath $archive -DestinationPath $unpack
    $exe = Get-ChildItem -LiteralPath $unpack -Filter "whisper-cli.exe" -File -Recurse | Select-Object -First 1
    if (!$exe) { Fail "Download do whisper.cpp não contém whisper-cli.exe." }
    $target = Join-Path $tools "whisper"
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    # Preserve adjacent DLL dependencies (CPU, OpenMP, ggml).
    Copy-Item -Path (Join-Path $exe.DirectoryName "*") -Destination $target -Force -Recurse
  }
  if (!(Has-Whisper)) { Fail "whisper-cli não está disponível após instalar." }
}
function Ensure-Model {
  if ($env:CONTENTLAB_WHISPER_MODEL) {
    if (!(Test-Path -LiteralPath $env:CONTENTLAB_WHISPER_MODEL -PathType Leaf)) { Fail "CONTENTLAB_WHISPER_MODEL aponta para um arquivo ausente." }
    Log "Modelo Whisper personalizado reutilizado."; return
  }
  $existing = Join-Path $HOME ".cache\whisper.cpp\ggml-base.bin"
  if (Test-Path -LiteralPath $existing -PathType Leaf) {
    $env:CONTENTLAB_WHISPER_MODEL = $existing
    Log "Modelo Whisper existente reutilizado."; return
  }
  $folder = Join-Path $tools "models"
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $model = Join-Path $folder "ggml-base.bin"
  if (!(Test-Path -LiteralPath $model -PathType Leaf)) {
    Log "Baixando modelo Whisper português/multilíngue base (~148 MB)..."
    $partial = "$model.partial"
    Fetch "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" $partial
    Verify-Hash $partial "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"
    Move-Item -LiteralPath $partial -Destination $model -Force
  }
  $env:CONTENTLAB_WHISPER_MODEL = $model
}
function Need-Install([string]$dir,[string]$dependency,[string]$manifest) {
  $stamp = Join-Path $dir "node_modules\.contentlab-package.sha256"
  $installed = Join-Path $dir ("node_modules\" + $dependency)
  if (!(Test-Path $installed -PathType Leaf) -or !(Test-Path $stamp -PathType Leaf)) { return $true }
  $expected = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifest).Hash
  return ((Get-Content -LiteralPath $stamp -Raw).Trim() -ine $expected)
}
function Save-Stamp([string]$dir,[string]$manifest) {
  $stamp = Join-Path $dir "node_modules\.contentlab-package.sha256"
  (Get-FileHash -Algorithm SHA256 -LiteralPath $manifest).Hash | Set-Content -LiteralPath $stamp -NoNewline
}
function Ensure-Browser {
  if ($env:CONTENTLAB_BOOTSTRAP_SKIP_BROWSER -eq "1") {
    Log "Chromium Remotion ignorado por CONTENTLAB_BOOTSTRAP_SKIP_BROWSER=1."; return
  }
  Log "Conferindo Chrome Headless Shell necessário ao Remotion..."
  $cli = Join-Path $root "backend\\remotion\\node_modules\\@remotion\\cli\\remotion-cli.js"
  Push-Location (Join-Path $root "backend\\remotion")
  try { & node $cli browser ensure; if ($LASTEXITCODE -ne 0) { Fail "Falha ao preparar navegador do Remotion." } }
  finally { Pop-Location }
}
function Ensure-Npm {
  if (Need-Install $root "express\package.json" (Join-Path $root "package.json")) {
    Log "Instalando/verificando dependências Node..."
    Push-Location $root
    try { & npm.cmd install --no-package-lock --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Fail "npm install falhou." } }
    finally { Pop-Location }
    Save-Stamp $root (Join-Path $root "package.json")
  } else { Log "Dependências Node atualizadas." }
  $remotion = Join-Path $root "backend\remotion"
  $lock = Join-Path $remotion "package-lock.json"
  if (Need-Install $remotion "remotion\package.json" $lock) {
    Log "Instalando/verificando Remotion..."
    & npm.cmd ci --prefix $remotion --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm ci (Remotion) falhou." }
    Save-Stamp $remotion $lock
  } else { Log "Dependências Remotion atualizadas." }
}
try {
  Ensure-Node
  Ensure-FFmpeg
  if ($env:CONTENTLAB_BOOTSTRAP_SKIP_WHISPER -ne "1") {
    Ensure-Whisper
    Ensure-Model
  } else { Log "Whisper ignorado por CONTENTLAB_BOOTSTRAP_SKIP_WHISPER=1." }
  Ensure-Npm
  Ensure-Browser
  Log "Dependências prontas."
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
