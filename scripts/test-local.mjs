// Enumerate explicitly: Node's globstar misses root scripts on this Windows host.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
function tests(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tests(path.join(dir,e.name)):e.name.endsWith('.test.mjs')?[path.join(dir,e.name)]:[]);}
const scripts=tests(path.join(root,'scripts')).sort();if(!scripts.length)throw Error('No script tests found');
const src=['src/shader/seam.test.ts','src/shader/material.test.mjs'];
for(const args of [['--test',...scripts],['--experimental-strip-types','--test',...src]]){const r=spawnSync(process.execPath,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:8*1048576});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;if(r.status!==0){process.exitCode=r.status??1;break;}}
