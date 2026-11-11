'use strict';
const fs=require('node:fs'),path=require('node:path');
exports.profile=(root,prefix)=>{const dir=path.join(root,'tmp');fs.mkdirSync(dir,{recursive:true});return fs.mkdtempSync(path.join(dir,prefix));};
exports.screenshot=(root,name)=>{const dir=path.join(root,'screenshots-current');fs.mkdirSync(dir,{recursive:true});return path.join(dir,name);};
