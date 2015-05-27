::windows batch script

@echo off
setlocal

::
:CheckPermission
  rem Check Permission
  fsutil dirty query >nul
  if %errorlevel% NEQ 0 ( goto PromptElevate ) else ( goto AfterElevate )

::
:PromptElevate
  rem Prompt Elevate Permission
  echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\~ElevatePermission.vbs"
  echo UAC.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\~ElevatePermission.vbs"
  "%temp%\~ElevatePermission.vbs"
  exit /b

::
:AfterElevate
  if exist "%temp%\~ElevatePermission.vbs" ( del "%temp%\~ElevatePermission.vbs" )
  cd /d %~dp0

::
:MainLogic
  certutil -addstore root telepod.ca.pem
  pause
