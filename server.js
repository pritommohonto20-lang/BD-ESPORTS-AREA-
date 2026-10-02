const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=process.env,PUB=path.join(__dirname,'public'),DATA=E.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DATA,'db.json');
fs.mkdirSync(DATA,{recursive:true});
const SECRET=E.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
let db={nextSeq:1,teams:[],settings:{roomId:E.ROOM_ID||'',roomPass:E.ROOM_PASSWORD||'',unlockAt:E.UNLOCK_AT||'',maxSlots:+E.MAX_SLOTS||48}};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(FILE,'utf8')))}catch(e){}
const save=()=>{fs.writeFileSync(FILE+'.tmp',JSON.stringify(db));fs.renameSync(FILE+'.tmp',FILE)};
const unlockMs=()=>Date.parse(db.settings.unlockAt)||0;
const clean=(s,n)=>String(s||'').trim().replace(/\s+/g,' ').slice(0,n);
const sign=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const h=s=>crypto.createHash('sha256').update(String(s)).digest();
const same=(a,b)=>crypto.timingSafeEqual(h(a),h(b));
const hits=new Map();
function limited(k,max,ms){const n=Date.now(),a=(hits.get(k)||[]).filter(t=>n-t<ms);a.push(n);hits.set(k,a);return a.length>max}
function isAdmin(req){const m=/(?:^|; )adm=([^;]+)/.exec(req.headers.cookie||'');if(!m)return false;const[p,s]=m[1].split('.');if(!p||!s||!same(sign(p),s))return false;try{return JSON.parse(Buffer.from(p,'base64url')).exp>Date.now()}catch(e){return false}}
function send(res,code,obj,hd){res.writeHead(code,Object.assign({'Content-Type':'application/json','Cache-Control':'no-store'},hd||{}));res.end(JSON.stringify(obj))}
function body(req){return new Promise((ok,no)=>{let n=0;const c=[];req.on('data',d=>{n+=d.length;if(n>200000){no(new Error('big'));req.destroy()}else c.push(d)});req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(c).toString()||'{}'))}catch(e){no(e)}});req.on('error',no)})}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const PUBLIC=['index.html','style.css','app.js','admin.html','admin.css','admin.js'];
function serve(res,p){
  if(p==='/')p='/index.html';
  const n=p.slice(1);
  if(!PUBLIC.includes(n)){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(n)]||'text/plain'});fs.createReadStream(path.join(__dirname,n)).pipe(res);
}
const view=t=>({seq:t.seq,teamName:t.teamName,leaderName:t.players[0].name,players:t.players,logo:t.logo});

http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://x'),p=u.pathname,m=req.method,ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
    if(!p.startsWith('/api/'))return serve(res,p);

    if(m==='GET'&&p==='/api/status')return send(res,200,{remain:Math.max(0,db.settings.maxSlots-db.teams.length),unlockAt:unlockMs()?new Date(unlockMs()).toISOString():'',now:Date.now()});

    if(m==='POST'&&p==='/api/register'){
      if(limited('reg'+ip,10,3600000))return send(res,429,{error:'Too many attempts. Try again later.'});
      const b=await body(req);
      if(db.teams.length>=db.settings.maxSlots)return send(res,409,{error:'All slots are full.'});
      const players=[['leader',b.leaderName,b.leaderUid],['p2',b.p2Name,b.p2Uid],['p3',b.p3Name,b.p3Uid],['p4',b.p4Name,b.p4Uid]].map(x=>({name:clean(x[1],30),uid:String(x[2]||'').trim()}));
      const teamName=clean(b.teamName,30);
      if(teamName.length<2)return send(res,400,{error:'Enter a team name.'});
      if(players.some(x=>x.name.length<2))return send(res,400,{error:'Enter all player names.'});
      if(players.some(x=>!/^\d{6,14}$/.test(x.uid)))return send(res,400,{error:'Every UID must be 6-14 digits.'});
      const uids=players.map(x=>x.uid);
      if(new Set(uids).size!==uids.length)return send(res,400,{error:'Duplicate UIDs in your squad.'});
      if(db.teams.some(t=>t.teamName.toLowerCase()===teamName.toLowerCase()))return send(res,409,{error:'This team name is already registered.'});
      if(db.teams.some(t=>t.players.some(x=>uids.includes(x.uid))))return send(res,409,{error:'One of these UIDs is already registered.'});
      const logo=typeof b.logo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(b.logo)&&b.logo.length<=60000?b.logo:'';
      const t={id:crypto.randomBytes(8).toString('hex'),token:crypto.randomBytes(16).toString('hex'),seq:'#'+String(db.nextSeq++).padStart(4,'0'),teamName,players,logo,at:new Date().toISOString()};
      db.teams.push(t);save();
      return send(res,200,{ok:true,token:t.token,seq:t.seq});
    }

    if(m==='GET'&&p==='/api/me'){
      const t=db.teams.find(x=>x.token===u.searchParams.get('token'));
      return t?send(res,200,view(t)):send(res,404,{error:'Team not found'});
    }

    if(m==='POST'&&p==='/api/room'){
      const b=await body(req),t=db.teams.find(x=>x.token===b.token);
      if(!t)return send(res,404,{error:'Team not found'});
      if(!unlockMs()||Date.now()<unlockMs())return send(res,403,{error:'Room is still locked. Wait for the countdown.'});
      if(!db.settings.roomId)return send(res,404,{error:'Admin has not added the room details yet.'});
      return send(res,200,{roomId:db.settings.roomId,roomPass:db.settings.roomPass});
    }

    if(m==='POST'&&p==='/api/admin/login'){
      if(!E.ADMIN_PASSWORD)return send(res,503,{error:'Set the ADMIN_PASSWORD environment variable first.'});
      if(limited('login'+ip,8,600000))return send(res,429,{error:'Too many attempts. Wait 10 minutes.'});
      const b=await body(req);
      if(!same(b.u,E.ADMIN_USER||'admin')||!same(b.p,E.ADMIN_PASSWORD))return send(res,401,{error:'Wrong username or password.'});
      const pl=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000})).toString('base64url');
      const sec=req.headers['x-forwarded-proto']==='https'?'; Secure':'';
      return send(res,200,{ok:true},{'Set-Cookie':'adm='+pl+'.'+sign(pl)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+sec});
    }
    if(m==='POST'&&p==='/api/admin/logout')return send(res,200,{ok:true},{'Set-Cookie':'adm=; HttpOnly; Path=/; Max-Age=0'});

    if(p.startsWith('/api/admin/')){
      if(!isAdmin(req))return send(res,401,{error:'Please log in.'});
      if(m==='GET'&&p==='/api/admin/settings')return send(res,200,db.settings);
      if(m==='POST'&&p==='/api/admin/settings'){
        const b=await body(req),ua=b.unlockAt?Date.parse(b.unlockAt):0;
        db.settings={roomId:clean(b.roomId,30),roomPass:clean(b.roomPass,30),unlockAt:ua?new Date(ua).toISOString():'',maxSlots:Math.min(1000,Math.max(1,parseInt(b.maxSlots)||48))};
        save();return send(res,200,{ok:true});
      }
      if(m==='GET'&&p==='/api/admin/teams')return send(res,200,db.teams.map(t=>({id:t.id,seq:t.seq,teamName:t.teamName,players:t.players,logo:t.logo,at:t.at})));
      if(m==='DELETE'&&p.startsWith('/api/admin/teams/')){
        const id=p.split('/')[4];db.teams=db.teams.filter(t=>t.id!==id);save();return send(res,200,{ok:true});
      }
    }
    send(res,404,{error:'Not found'});
  }catch(e){send(res,e.message==='big'?413:400,{error:e.message==='big'?'Request too large':'Bad request'})}
}).listen(+E.PORT||3000,'0.0.0.0',()=>console.log('BD ESPORTS AREA running on port '+(E.PORT||3000)));
