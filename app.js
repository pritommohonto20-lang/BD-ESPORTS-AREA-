var $=function(i){return document.getElementById(i)},TK='bdea_token',logo='',offset=0,unlockAt=0,timer;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function gt(){try{return localStorage.getItem(TK)}catch(e){return null}}
function st(v){try{v?localStorage.setItem(TK,v):localStorage.removeItem(TK)}catch(e){}}
async function api(url,opt){var r=await fetch(url,opt),j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||'Something went wrong');return j}
function pad(n){return String(n).padStart(2,'0')}
function run(){clearTimeout(timer);var r=unlockAt?unlockAt-(Date.now()+offset):0;if(r<0)r=0;var s=Math.floor(r/1000);
  $('d').textContent=pad(Math.floor(s/86400));$('h').textContent=pad(Math.floor(s%86400/3600));$('m').textContent=pad(Math.floor(s%3600/60));$('s').textContent=pad(s%60);
  if(r>0)timer=setTimeout(run,1000)}
async function loadStatus(){try{var s=await api('/api/status');offset=s.now-Date.now();unlockAt=s.unlockAt?Date.parse(s.unlockAt):0;
  $('remain').textContent=s.remain;$('roomTime').textContent=unlockAt?new Date(unlockAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'To be announced';run()}catch(e){}}
function showSuccess(seq){$('form').classList.add('hidden');$('success').classList.remove('hidden');$('seq').textContent=seq;loadStatus();window.scrollTo(0,0)}

$('regForm').querySelector('input[type=file]').addEventListener('change',function(e){
  var f=e.target.files[0];logo='';if(!f)return;
  var img=new Image();img.onload=function(){var k=Math.min(1,160/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    logo=c.toDataURL('image/jpeg',.8);$('preview').src=logo;$('preview').style.display='block';$('uploadLabel').style.display='none'};
  img.src=URL.createObjectURL(f)});

$('regForm').addEventListener('submit',async function(e){
  e.preventDefault();var f=e.target,v=function(n){return f.elements[n].value.trim()},b=f.querySelector('button.yellow');
  $('msg').textContent='';b.disabled=true;
  try{var r=await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    teamName:v('teamName'),leaderName:v('leaderName'),leaderUid:v('leaderUid'),p2Name:v('p2Name'),p2Uid:v('p2Uid'),p3Name:v('p3Name'),p3Uid:v('p3Uid'),p4Name:v('p4Name'),p4Uid:v('p4Uid'),logo:logo})});
    st(r.token);showSuccess(r.seq)}catch(x){$('msg').textContent=x.message}
  b.disabled=false});

async function openMyDetails(){
  try{var t=await api('/api/me?token='+encodeURIComponent(gt()||'')),h='';
    if(t.logo)h+='<img src="'+esc(t.logo)+'" style="width:80px;height:80px;border-radius:16px;object-fit:cover">';
    h+='<h2>'+esc(t.teamName)+'</h2><p>Sequence: <b>'+esc(t.seq)+'</b></p>';
    t.players.forEach(function(p,i){h+='<p>'+(i?'Player '+(i+1):'Leader')+': <b>'+esc(p.name)+'</b> — UID '+esc(p.uid)+'</p>'});
    $('dlgBody').innerHTML=h}catch(e){$('dlgBody').textContent=e.message}
  $('dlg').showModal()}

async function getRoom(){
  var box=$('roomInfo');box.classList.remove('hidden');
  try{var r=await api('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:gt()})});
    box.innerHTML='Room ID: <b>'+esc(r.roomId)+'</b><br>Password: <b>'+esc(r.roomPass)+'</b>'}catch(e){box.textContent=e.message}}

(async function(){await loadStatus();var t=gt();if(t){try{var r=await api('/api/me?token='+encodeURIComponent(t));showSuccess(r.seq)}catch(e){st(null)}}})();
