const ORIGIN='https://ui.perfetto.dev';
const ASSETS=new URL('./data/',import.meta.url);
function waitForPerfetto(win, timeoutMs = 60000) {
  return new Promise((resolve,reject) => {
    const clean = () => { clearInterval(ping); clearTimeout(deadline); window.removeEventListener('message',receive); };
    const receive = e => { if(e.origin === ORIGIN && e.source === win && e.data === 'PONG') {clean();resolve();} };
    window.addEventListener('message',receive);
    const ping = setInterval(() => {
      if(win.closed) {clean();reject(new Error('The Perfetto window was closed.'));return;}
      win.postMessage('PING',ORIGIN);
    },200);
    const deadline = setTimeout(() => {clean();reject(new Error('Perfetto did not respond. Check your connection and retry.'));},timeoutMs);
  });
}

async function readTrace(key, full = false) {
  const url = new URL(`${key}${full ? '-full' : ''}.json.gz`,ASSETS);
  const response = await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok) throw new Error(`Trace download failed (HTTP ${response.status}). Use the Google Drive source link.`);
  const bytes = await response.arrayBuffer();
  const header = new Uint8Array(bytes,0,Math.min(2,bytes.byteLength));
  // Also accepts servers which transparently decompress gzip via Content-Encoding.
  if(header[0] !== 0x1f || header[1] !== 0x8b) return bytes;
  if(!('DecompressionStream' in window)) throw new Error('This browser cannot unpack the trace. Use a current browser or download the source from Google Drive.');
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

function postTrace(win,buffer,key,full) {
  win.postMessage({perfetto:{buffer,title:`${key} baseline — ${full ? 'complete original trace' : 'selected tracks excerpt'}`,
    fileName:`${key}-${full ? 'baseline-rank0' : 'blog-excerpt'}.json`,
    keepApiOpen:true,downloadable:true,shareable:false}},ORIGIN,[buffer]);
}

export async function openFullTrace(key,status){
 const win=window.open(ORIGIN,'_blank');
 if(!win){status.textContent='Allow a new tab to open the full trace.';return;}
 status.textContent='Opening the original trace…';
 try{const [buffer]=await Promise.all([readTrace(key,true),waitForPerfetto(win)]);postTrace(win,buffer,key,true);status.textContent='Original trace opened in Perfetto.';}
 catch(error){status.textContent=error.message;}
}
