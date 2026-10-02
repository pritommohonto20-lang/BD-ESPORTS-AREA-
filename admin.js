var $=function(i){return document.getElementById(i)},J={'Content-Type':'application/json'};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
async function api(url,opt){var r=await fetch(url,opt),j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||'Error');return j}
async function login(){try{await api('/api/admin/login',{method:'POST',headers:J,body:JSON.stringify({u:$('u').value,p:$('p').value})});await enter()}catch(e){$('err').textContent=e.message}}
async function enter(){var s=await api('/api/admin/settings');$('login').classList.add('hidden');$('panel').classList.remove('hidden');
  $('rid').value=s.roomId;$('rp').value=s.roomPass;$('ms').value=s.maxSlots;
  if(s.unlockAt){var d=new Date(s.unlockAt);$('ua').value=new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
  await loadTeams()}
async function saveSettings(){try{await api('/api/admin/settings',{method:'POST',headers:J,body:JSON.stringify({roomId:$('rid').value,roomPass:$('rp').value,maxSlots:$('ms').value,unlockAt:$('ua').value?new Date($('ua').value).toISOString():''})});alert('Saved');loadTeams()}catch(e){alert(e.message)}}
async function loadTeams(){var t=await api('/api/admin/teams'),s=await api('/api/admin/settings');
  $('stats').innerHTML='<div class="stat"><b>'+t.length+'</b>Teams</div><div class="stat"><b>'+s.maxSlots+'</b>Max slots</div><div class="stat"><b>'+Math.max(0,s.maxSlots-t.length)+'</b>Remaining</div>';
  $('teams').innerHTML=t.map(function(x){return '<div class="team">'+(x.logo?'<img src="'+esc(x.logo)+'" width="48" height="48" style="border-radius:10px;float:right">':'')+
    '<h3>'+esc(x.seq)+' '+esc(x.teamName)+'</h3><p>'+x.players.map(function(p){return esc(p.name)+' ('+esc(p.uid)+')'}).join(' • ')+'</p>'+
    '<button class="danger" onclick="delTeam(\''+esc(x.id)+'\')">DELETE</button></div>'}).join('')||'<p>No teams yet.</p>'}
async function delTeam(id){if(!confirm('Delete this team?'))return;await api('/api/admin/teams/'+id,{method:'DELETE'});loadTeams()}
async function logout(){await api('/api/admin/logout',{method:'POST'});location.reload()}
enter().catch(function(){});
