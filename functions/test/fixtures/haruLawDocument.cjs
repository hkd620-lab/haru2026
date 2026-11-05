const JSZip=require('jszip');
const {deflateRawSync}=require('node:zlib');
// 독립적인 최소 CFB 컨테이너: FAT·디렉터리·FileHeader·BodyText/Section0.
function hwp(text, flags=0, corrupt=false) {
  const file = Buffer.alloc(19*512), header=file.subarray(0,512);
  Buffer.from('d0cf11e0a1b11ae1','hex').copy(header);
  header.writeUInt16LE(0x3e,24); header.writeUInt16LE(3,26); header.writeUInt16LE(0xfffe,28);
  header.writeUInt16LE(9,30); header.writeUInt16LE(6,32); header.writeUInt32LE(1,44); header.writeUInt32LE(1,48);
  header.writeUInt32LE(4096,56); header.writeUInt32LE(0xfffffffe,60); header.writeUInt32LE(0xfffffffe,68);
  header.fill(0xff,76); header.writeUInt32LE(0,76);
  const fat=file.subarray(512,1024);fat.fill(0xff);fat.writeUInt32LE(0xfffffffd,0);fat.writeUInt32LE(0xfffffffe,4);
  for(let i=2;i<=17;i++)fat.writeUInt32LE(i===9||i===17?0xfffffffe:i+1,i*4);
  function entry(id,name,type,start,size,child=0xffffffff,right=0xffffffff){
    const d=file.subarray(1024+id*128,1024+(id+1)*128);Buffer.from(name+'\0','utf16le').copy(d);
    d.writeUInt16LE((name.length+1)*2,64);d[66]=type;d[67]=1;d.writeUInt32LE(0xffffffff,68);d.writeUInt32LE(right,72);d.writeUInt32LE(child,76);d.writeUInt32LE(start,116);d.writeUInt32LE(size,120);
  }
  entry(0,'Root Entry',5,0xfffffffe,0,1);entry(1,'FileHeader',2,2,4096,0xffffffff,2);entry(2,'BodyText',1,0,0,3);entry(3,'Section0',2,10,4096);
  const fh=file.subarray(3*512,11*512);fh.write('HWP Document File','ascii');fh[35]=5;fh.writeUInt32LE(flags,36);
  const content=Buffer.from(text,'utf16le'),record=Buffer.alloc(content.length+4);record.writeUInt32LE(corrupt?0xfff00043:((content.length<<20)|0x43)>>>0);content.copy(record,4);
  let section=record;
  if(flags&1)section=deflateRawSync(section);
  else {section=Buffer.alloc(4096);record.copy(section);const remaining=4096-record.length;if(remaining>=4)section.writeUInt32LE(((remaining-4)<<20)>>>0,record.length);}
  section.copy(file,11*512);return file;
}
async function hwpx(xml, extras={}) {
  const zip=new JSZip();zip.file('mimetype','application/hwp+zip');zip.file('Contents/content.hpf','<package><manifest><item id="section0" href="section0.xml"/></manifest><spine><itemref idref="section0"/></spine></package>');zip.file('Contents/section0.xml',xml);for(const [p,c]of Object.entries(extras))zip.file(p,c);
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
module.exports={hwp,hwpx};
