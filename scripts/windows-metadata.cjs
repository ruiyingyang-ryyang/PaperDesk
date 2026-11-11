'use strict';
const fs=require('node:fs'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
// Windows still needs numeric PE fields. Their strings are empty, so Explorer's
// user-facing FileVersion/ProductVersion values have no release label.
async function clearVersionLabels(file){const req=createRequire(require.resolve('@electron/packager'));const {NtExecutable,NtExecutableResource,Resource}=await import(pathToFileURL(req.resolve('resedit')).href);const exe=NtExecutable.from(fs.readFileSync(file)),res=NtExecutableResource.from(exe);for(const version of Resource.VersionInfo.fromEntries(res.entries)){Object.assign(version.fixedInfo,{fileVersionMS:0,fileVersionLS:0,productVersionMS:0,productVersionLS:0});for(const language of version.getAllLanguagesForStringValues())version.setStringValues(language,{FileVersion:'',ProductVersion:''});version.outputToResourceEntries(res.entries);}res.outputResource(exe);fs.writeFileSync(file,Buffer.from(exe.generate()));}
module.exports={clearVersionLabels};
