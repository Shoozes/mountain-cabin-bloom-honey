// Lossless RGBA authoring output, using Node's standard zlib implementation.
import {deflateSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
/** @param {string} name @param {Uint8Array} data */
function chunk(name,data){const tag=Buffer.from(name),body=Buffer.concat([tag,data]);let crc=0xffffffff;for(const b of body)crc=table[(crc^b)&255]^(crc>>>8);const out=Buffer.alloc(body.length+8);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
/** @param {{width:number,height:number,data:Uint8Array}} pixels */
export function encodeMaterialPng({width,height,data}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048||!(data instanceof Uint8Array)||data.length!==width*height*4)throw Error('Invalid RGBA pixels');
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)rows.set(data.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
