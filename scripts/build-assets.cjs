'use strict';
const fs=require('node:fs');const path=require('node:path');
const sharp=require('sharp');
(async()=>{
  const dir=path.join(__dirname,'../assets');
  await sharp(path.join(dir,'icon.svg')).resize(512,512).png().toFile(path.join(dir,'icon.png'));
  const sizes=[16,24,32,48,64,128,256];
  const images=await Promise.all(sizes.map(size=>sharp(path.join(dir,'icon.svg')).resize(size,size).png().toBuffer()));
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((size,i)=>{const at=6+16*i;header[at]=header[at+1]=size===256?0:size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(images[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=images[i].length;});
  fs.writeFileSync(path.join(dir,'icon.ico'),Buffer.concat([header,...images]));
  console.log('Generated icon.png and seven-size Windows icon.ico');
})().catch(e=>{console.error(e);process.exitCode=1;});
