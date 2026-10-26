// Read-only scanner verification. Published incoming keys remain in process memory; no seed is used.
import fs from 'node:fs';
import net from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const bin='/Volumes/Extreme SSD/Projects/grokbot/projects/zec-unlinkable-swaps/packages/scan/target/release/zpay-verify';
const redact=s=>s.replace(/(?:uivk|uview|ufvk)[a-zA-Z0-9]+/g,'[VIEWING_KEY_REDACTED]');
const evidence=[];
async function run(args,extra={}){
 const start=Date.now(),p=spawn(bin,args,{env:{PATH:process.env.PATH,...extra}});let stdout='',stderr='';
 p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);
 const timer=setTimeout(()=>p.kill('SIGKILL'),75000);
 const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',resolve)});clearTimeout(timer);
 const row={pid:p.pid,args,code,ms:Date.now()-start,stdout:redact(stdout),stderr:redact(stderr)};evidence.push(row);return row;
}
let sockets=[],listener;
try{
 const lwd=fs.readFileSync('packages/scan/src/lwd.rs','utf8'),lib=fs.readFileSync('packages/scan/src/lib.rs','utf8');
 assert(lwd.includes('tokio::time::timeout(CONNECT_TIMEOUT, ep.connect())'));
 assert(lwd.includes('Duration::from_secs(10)')&&lwd.includes('.timeout(Duration::from_secs(60))'));
 assert(lwd.includes('max_decoding_message_size(32 * 1024 * 1024)'));
 for(const s of ['height: from','height: to','blocks += 1','id.reverse()','compact_hits::<OrchardVersion>','compact_hits::<IronwoodVersion>','PreparedIncomingViewingKey::new(ivk)'])assert(lib.includes(s),s);
 evidence.push({sourceContract:'inclusive bounds, actual streamed block count, display-order txids, local Orchard/Ironwood trial decryption, 10s connection, 60s RPC, 32MiB decode bound',ok:true});
 const d=JSON.parse(fs.readFileSync('deployments/testnet.json','utf8'));
 const keyEnv={ZPV_UIVKS:['account='+d.account.uivk,...d.refundKeys.map(k=>'refund-'+k.index+'='+k.uivk)].join(',')};
 const r=await run(['scan-range','4522708','4522730'],keyEnv);assert.equal(r.code,0,r.stderr);const v=JSON.parse(r.stdout);assert.equal(v.blocks,23);assert.equal(v.from,4522708);assert.equal(v.to,4522730);
 for(const [label,txid,zat]of [['refund-0',d.txs['refund-0'],30000],['refund-1',d.txs['refund-1'],31000],['refund-2',d.txs['refund-2'],32000],['account',d.txs.account,25000]]){const hits=v.hits.filter(h=>h.txid===txid);assert.equal(hits.length,1);assert.equal(hits[0].key,label);assert.equal(hits[0].value,zat)}
 listener=net.createServer(s=>sockets.push(s));await new Promise(r=>listener.listen(0,'127.0.0.1',r));
 const stalled=await run(['tip'],{ZPV_LWD_URL:'https://127.0.0.1:'+listener.address().port});
 assert.equal(stalled.code,2);assert(stalled.stderr.includes('connection did not finish in 10 s'));assert(stalled.ms>=9900&&stalled.ms<14000);
 evidence.push({connectionTimeoutObserved:true,seedAccessed:false,transactionsSent:0});
 fs.writeFileSync('audit/cli/RS-026.txt',JSON.stringify({id:'RS-026',status:'PASS',at:new Date().toISOString(),binarySha256:createHash('sha256').update(fs.readFileSync(bin)).digest('hex'),build:'cargo build --release --manifest-path packages/scan/Cargo.toml using current worktree source',evidence},null,2)+'\n');console.log('RS-026 PASS');
}catch(e){fs.writeFileSync('audit/cli/RS-026.txt',JSON.stringify({id:'RS-026',status:'FAIL',error:redact(e.message),evidence},null,2)+'\n');console.error(redact(e.message));process.exitCode=1}
finally{for(const s of sockets)s.destroy();if(listener)await new Promise(r=>listener.close(r))}
