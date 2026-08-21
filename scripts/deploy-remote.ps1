# Windows -> 바닐라폼 전용 서버 SSH 배포 + 재시작.
#
# 사용:
#   .\scripts\deploy-remote.ps1
#
# 환경변수로 오버라이드 가능:
#   VANILLAFORM_DEPLOY_SSH_KEY   필수: 바닐라폼 전용 SSH 키
#   VANILLAFORM_DEPLOY_SSH_USER  기본 ubuntu
#   VANILLAFORM_DEPLOY_SSH_HOST  필수: 바닐라폼 전용 서버 호스트
#   VANILLAFORM_DEPLOY_REPO_DIR  기본 /home/ubuntu/vanillaform
#   VANILLAFORM_DEPLOY_BRANCH    기본 main
#   VANILLAFORM_DEPLOY_PM2_NAME  기본 vanillaform

$ErrorActionPreference = 'Stop'

function Get-EnvOrDefault($name, $default) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) { return $default } else { return $v }
}

$SshKey  = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_KEY'  ''
$SshUser = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_USER' 'ubuntu'
$SshHost = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_HOST' ''
$RepoDir = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_REPO_DIR' '/home/ubuntu/vanillaform'
$Branch  = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_BRANCH'   'main'
$PmName  = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_PM2_NAME' 'vanillaform'

if ([string]::IsNullOrWhiteSpace($SshKey) -or [string]::IsNullOrWhiteSpace($SshHost)) {
  Write-Error '바닐라폼 전용 SSH 키와 서버 호스트를 먼저 설정하세요.'
  exit 1
}

if ($SshHost -eq '15.165.111.176') {
  Write-Error '이전 서비스 서버 주소는 바닐라폼 배포 대상으로 사용할 수 없습니다.'
  exit 1
}

if (-not (Test-Path $SshKey)) {
  Write-Error "SSH 키 파일 없음: $SshKey"
  exit 1
}

$ScriptPath = Join-Path $PSScriptRoot 'deploy.sh'
if (-not (Test-Path $ScriptPath)) {
  Write-Error "deploy.sh 가 같은 디렉토리에 없음: $ScriptPath"
  exit 1
}

Write-Host "[deploy] target  : $SshUser@$SshHost"
Write-Host "[deploy] repo    : $RepoDir"
Write-Host "[deploy] branch  : $Branch"
Write-Host "[deploy] pm2 app : $PmName"
Write-Host "[deploy] key     : $SshKey"
Write-Host ""

# CRLF/단독 CR -> LF 정규화 + BOM 제거.
# PowerShell 파이프($body | ssh)는 BOM과 끝 CRLF 를 덧붙여 원격 bash 에서
# 가짜 오류(줄1 shebang 실패, 마지막 줄 \r 명령 없음)를 만들므로,
# BOM 없는 임시 파일로 저장한 뒤 cmd 의 stdin 리다이렉트로 바이트 그대로 전달한다.
$ScriptBody = ((Get-Content $ScriptPath -Raw) -replace "`r", "")
$ScriptBody = $ScriptBody.TrimStart([char]0xFEFF)
$TempScript = Join-Path $env:TEMP 'vanillaform-deploy.sh'
[System.IO.File]::WriteAllText($TempScript, $ScriptBody, (New-Object System.Text.UTF8Encoding($false)))

# stdin 으로 스크립트 전달 -> 원격에서 bash -s 가 실행. 위치인자로 설정 주입.
$CmdLine = 'ssh -i "{0}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 {1}@{2} "bash -s -- ''{3}'' ''{4}'' ''{5}''" < "{6}"' -f `
  $SshKey, $SshUser, $SshHost, $RepoDir, $Branch, $PmName, $TempScript
cmd /c $CmdLine

if ($LASTEXITCODE -ne 0) {
  Write-Error "배포 실패 (exit $LASTEXITCODE)"
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[deploy] 완료" -ForegroundColor Green
