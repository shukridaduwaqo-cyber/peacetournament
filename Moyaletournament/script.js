/* ============================================================
   MOYALE TOURNAMENT — LIVE FROM GOOGLE SHEETS
   ============================================================ */

// ▼▼▼ PASTE YOUR PUBLISHED CSV URL HERE ▼▼▼
var CSV_URL = https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5z4TwJ11enKRwK-gCyjzmnOhzF6nMhu2-fWq4xwiqer04Fjps7XKYg_GUucuaRIdVqDqkkqJhS0VJ/pub?gid=0&single=true&output=csv
// ▲▲▲ Get this from File → Share → Publish to web → CSV ▲▲▲

var REFRESH_SECONDS = 60; // How often the site re-reads the sheet

var POOLS = {
    'POOL A': ['Moyale Star KE','Al-Rahman FC','Al-Naim FC','Migos FC'],
    'POOL B': ['Moyale Star ET','Odda FC','Tokkuma FC','Buladi FC'],
    'POOL C': ['Al-Fajr FC','Laheytara FC','All-Star FC','Volta FC'],
    'POOL D': ['Tile FC','Moyale Legend FC','Anwar FC','Bole FC']
};

var MATCHES = [];
var pool = 'POOL A';
var filter = 'ALL';
var lastUpdated = null;

function $(id){return document.getElementById(id);}
function ini(n){var w=n.replace(/[^A-Za-z0-9 ]/g,'').split(' ').filter(Boolean);if(!w.length)return'?';if(w.length===1)return w[0].substring(0,2).toUpperCase();return(w[0][0]+w[1][0]).toUpperCase();}
function isPlayed(m){return (m.homeScore!==0||m.awayScore!==0||m.homeScorers||m.awayScorers);}

/* ---------- CSV PARSER (handles quoted fields) ---------- */
function parseCSV(text){
    var rows=[],cur=[],field='',inQ=false;
    for(var i=0;i<text.length;i++){
        var c=text[i];
        if(inQ){
            if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQ=false; }
            else field+=c;
        } else {
            if(c==='"') inQ=true;
            else if(c===','){ cur.push(field); field=''; }
            else if(c==='\n'){ cur.push(field); rows.push(cur); cur=[]; field=''; }
            else if(c==='\r'){ /* skip */ }
            else field+=c;
        }
    }
    if(field!==''||cur.length){cur.push(field);rows.push(cur);}
    return rows;
}

/* ---------- FETCH FROM GOOGLE SHEETS ---------- */
function loadFromSheet(){
    if(CSV_URL.indexOf('PASTE_YOUR')===0){
        console.warn('CSV_URL not set — paste your published URL in script.js');
        return;
    }

    fetch(CSV_URL + '&cachebust=' + Date.now(), {cache:'no-store'})
        .then(function(r){ return r.text(); })
        .then(function(csv){
            var rows = parseCSV(csv);
            if(rows.length < 2) return;

            var header = rows[0].map(function(h){return h.trim().toLowerCase();});
            var idx = {
                id: header.indexOf('id'),
                date: header.indexOf('date'),
                pool: header.indexOf('pool'),
                home: header.indexOf('home'),
                away: header.indexOf('away'),
                hs: header.indexOf('homescore'),
                as: header.indexOf('awayscore'),
                hsc: header.indexOf('homescorers'),
                asc: header.indexOf('awayscorers')
            };

            var matches = [];
            for(var i=1;i<rows.length;i++){
                var r = rows[i];
                if(!r[idx.id]) continue;
                matches.push({
                    id: (r[idx.id]||'').trim(),
                    date: (r[idx.date]||'').trim(),
                    pool: (r[idx.pool]||'').trim(),
                    home: (r[idx.home]||'').trim(),
                    away: (r[idx.away]||'').trim(),
                    homeScore: parseInt(r[idx.hs],10)||0,
                    awayScore: parseInt(r[idx.as],10)||0,
                    homeScorers: (r[idx.hsc]||'').trim(),
                    awayScorers: (r[idx.asc]||'').trim()
                });
            }

            MATCHES = matches;
            lastUpdated = new Date();
            renderAll();
            flashLive();
        })
        .catch(function(e){
            console.error('Failed to load sheet:', e);
        });
}

function flashLive(){
    var d = $('liveDot');
    if(!d) return;
    d.style.opacity = '0.2';
    setTimeout(function(){ d.style.opacity = '1'; }, 250);
}

/* ---------- RENDER ---------- */
function renderAll(){
    renderFixtures();
    updateStandings();
    updateScorers();
    applyFilters();
}

function renderFixtures(){
    var L=$('flist'); if(!L) return;
    var h='';
    for(var i=0;i<MATCHES.length;i++){
        var m=MATCHES[i];
        var pl=m.pool.replace('POOL ','');
        var ta=(m.home+' '+m.away).toLowerCase();
        h+='<div class="mc match-row" data-pool="'+m.pool+'" data-teams="'+ta+'"><div class="mm">';
        h+='<div class="mmeta"><span class="mid">'+m.id+'</span><span class="mdate">'+m.date+'</span><span class="mpool">Pool '+pl+'</span></div>';
        h+='<div class="mteam h"><span>'+m.home+'</span><div class="badge">'+ini(m.home)+'</div></div>';
        h+='<div class="mscore"><span class="score-display">'+m.homeScore+'</span><span class="sep2">:</span><span class="score-display">'+m.awayScore+'</span></div>';
        h+='<div class="mteam"><div class="badge">'+ini(m.away)+'</div><span>'+m.away+'</span></div>';
        h+='<div class="mactions"><button type="button" class="bdet" onclick="toggleDetails(this)">Details</button></div></div>';
        h+='<div class="dp"><div class="dgrid">';
        h+='<div class="dcol"><label>'+m.home+' Scorers &amp; Time</label><div class="scorer-display '+(m.homeScorers?'':'empty')+'">'+(m.homeScorers||'')+'</div></div>';
        h+='<div class="dcol"><label>'+m.away+' Scorers &amp; Time</label><div class="scorer-display '+(m.awayScorers?'':'empty')+'">'+(m.awayScorers||'')+'</div></div>';
        h+='</div></div></div>';
    }
    L.innerHTML=h;
}

function toggleDetails(b){
    var c=b.closest('.mc'),p=c.querySelector('.dp');
    if(p.classList.contains('on')){p.classList.remove('on');b.textContent='Details';}
    else{p.classList.add('on');b.textContent='Hide';}
}

function computeStats(){
    var s={};
    Object.keys(POOLS).forEach(function(p){
        s[p]={};
        POOLS[p].forEach(function(t){s[p][t]={team:t,P:0,W:0,D:0,L:0,GF:0,GA:0,GD:0,Pts:0};});
    });
    MATCHES.forEach(function(m){
        if(!isPlayed(m)) return;
        var hg=m.homeScore,ag=m.awayScore;
        var H=s[m.pool] ? s[m.pool][m.home] : null;
        var A=s[m.pool] ? s[m.pool][m.away] : null;
        if(!H||!A) return;
        H.P++;A.P++;H.GF+=hg;H.GA+=ag;A.GF+=ag;A.GA+=hg;
        if(hg>ag){H.W++;A.L++;H.Pts+=3;}
        else if(hg<ag){A.W++;H.L++;A.Pts+=3;}
        else{H.D++;A.D++;H.Pts++;A.Pts++;}
    });
    Object.keys(s).forEach(function(p){
        Object.keys(s[p]).forEach(function(t){var r=s[p][t];r.GD=r.GF-r.GA;});
    });
    return s;
}

function updateStandings(){
    var s=computeStats();
    renderStandings(s);
    renderTeams(s);
}

function renderStandings(s){
    var tb=$('stBody'); if(!tb) return;
    var rows=Object.keys(s[pool]).map(function(t){return s[pool][t];});
    rows.sort(function(a,b){
        if(b.Pts!==a.Pts) return b.Pts-a.Pts;
        if(b.GD!==a.GD) return b.GD-a.GD;
        if(b.GF!==a.GF) return b.GF-a.GF;
        return a.team.localeCompare(b.team);
    });
    var h='';
    rows.forEach(function(r,i){
        var c=i<2?'q':'';
        var g=r.GD>0?'gp':r.GD<0?'gn':'';
        h+='<tr class="'+c+'"><td class="pos">'+(i+1)+'</td>';
        h+='<td><div class="tc"><div class="badge">'+ini(r.team)+'</div><span>'+r.team+'</span></div></td>';
        h+='<td>'+r.P+'</td><td>'+r.W+'</td><td>'+r.D+'</td><td>'+r.L+'</td>';
        h+='<td>'+r.GF+':'+r.GA+'</td>';
        h+='<td class="'+g+'">'+(r.GD>0?'+':'')+r.GD+'</td>';
        h+='<td class="pts">'+r.Pts+'</td></tr>';
    });
    tb.innerHTML=h;
}

function selectPool(p,b){
    pool=p;
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
    if(b)b.classList.add('on');
    renderStandings(computeStats());
}

function updateScorers(){
    var L=$('scl'); if(!L) return;
    var t={};
    MATCHES.forEach(function(m){ ts(m.homeScorers,m.home,t); ts(m.awayScorers,m.away,t); });
    var e=Object.keys(t).map(function(k){return{name:k,goals:t[k].goals,team:t[k].team};});
    if(!e.length){ L.innerHTML='<div class="empty">No goals recorded yet.</div>'; return; }
    e.sort(function(a,b){ if(b.goals!==a.goals) return b.goals-a.goals; return a.name.localeCompare(b.name); });
    var mx=e[0].goals, h='';
    e.slice(0,15).forEach(function(x,i){
        var pct=mx>0?(x.goals/mx)*100:0;
        h+='<div class="srow"><div class="srank">'+(i+1)+'</div>';
        h+='<div><div class="sname">'+x.name+'</div><div class="steam">'+x.team+'</div></div>';
        h+='<div class="sbar"><div class="sbarf" style="width:'+pct+'%"></div></div>';
        h+='<div class="sgoals">'+x.goals+'</div></div>';
    });
    L.innerHTML=h;
}

function ts(str,team,t){
    if(!str) return;
    str.split(/[,;]/).forEach(function(p){
        var c=p.trim(); if(!c) return;
        var n=c.replace(/\s*\d.*$/,'').trim();
        if(!n) n=c.split(/\s/)[0];
        if(!n) return;
        if(!t[n]) t[n]={goals:0,team:team};
        t[n].goals++;
    });
}

function filterPool(p,b){
    filter=p;
    document.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');});
    if(b)b.classList.add('on');
    applyFilters();
}

function applyFilters(){
    var el=$('searchIn'),term=el?el.value.toLowerCase().trim():'';
    document.querySelectorAll('.match-row').forEach(function(r){
        var p=r.dataset.pool,tt=r.dataset.teams||'';
        var po=(filter==='ALL')||(p===filter);
        var so=(term==='')||(tt.indexOf(term)!==-1);
        r.style.display=(po&&so)?'':'none';
    });
}

function renderTeams(s){
    var g=$('tgrid'); if(!g) return;
    var h='';
    Object.keys(POOLS).forEach(function(p){
        POOLS[p].forEach(function(t){
            var x=s[p][t];
            h+='<div class="tcard"><div class="tcrest">'+ini(t)+'</div>';
            h+='<h4>'+t+'</h4><div class="tpool">Pool '+p.replace('POOL ','')+'</div>';
            h+='<div class="tstats">';
            h+='<div><span>Played</span><b>'+x.P+'</b></div>';
            h+='<div><span>Won</span><b>'+x.W+'</b></div>';
            h+='<div><span>Points</span><b>'+x.Pts+'</b></div>';
            h+='</div></div>';
        });
    });
    g.innerHTML=h;
}

function updateCountdown(){
    var target=new Date(2026,8,18,16,0,0).getTime(),diff=target-Date.now();
    var d1=$('cd1'),d2=$('cd2'),d3=$('cd3'),d4=$('cd4');
    if(!d1) return;
    if(diff<=0){ d1.textContent='00';d2.textContent='00';d3.textContent='00';d4.textContent='00'; return; }
    d1.textContent=String(Math.floor(diff/86400000)).padStart(2,'0');
    d2.textContent=String(Math.floor((diff%86400000)/3600000)).padStart(2,'0');
    d3.textContent=String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    d4.textContent=String(Math.floor((diff%60000)/1000)).padStart(2,'0');
}

function init(){
    updateCountdown();
    setInterval(updateCountdown,1000);
    loadFromSheet();
    setInterval(loadFromSheet, REFRESH_SECONDS * 1000);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();