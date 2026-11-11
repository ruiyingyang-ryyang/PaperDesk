'use strict';
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const C=require('./core.cjs');
const TASK='PaperDesk-Weekly',LEGACY='PaperDesk-Friday-0800';
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
function command({enabled,exe,scheduleDay,scheduleTime}){
 const p=C.scheduleParameters({scheduleDay,scheduleTime});
 const remove=name=>`if(Get-ScheduledTask -TaskName ${quote(name)} -ErrorAction SilentlyContinue){Unregister-ScheduledTask -TaskName ${quote(name)} -Confirm:$false};`;
 if(!enabled)return "$ErrorActionPreference='Stop'; "+remove(TASK)+remove(LEGACY);
 return `$ErrorActionPreference='Stop'; $u=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $a=New-ScheduledTaskAction -Execute ${quote(exe)} -Argument '--scheduled'; $t=New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${DAYS[p.scheduleDay]} -At ${quote(p.scheduleTime)}; $l=New-ScheduledTaskTrigger -AtLogOn -User $u; $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero); $p=New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Limited; Register-ScheduledTask -TaskName ${quote(TASK)} -Action $a -Trigger @($t,$l) -Settings $s -Principal $p -Force | Out-Null; `+remove(LEGACY);
}
async function update(options){try{await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command(options),'utf16le').toString('base64')],{windowsHide:true,timeout:30000});}catch{throw Error('SCHEDULE_REGISTER_FAILED');}}
module.exports={TASK,LEGACY,command,update};
