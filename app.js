let _saveTimer=null;
// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
const JOURS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const EXCEL_COLORS=['#B1A0C7','#DA9694','#00B050','#FFC000','#CC00CC','#FF0000','#FFFF00','#4F81BD','#002060','#00FFFF','#808080','#7030A0'];
const DEFAULT_PWD='1234';
const MS_DAY=86400000;
const XL_SEM=[
  {header:1,contrat:2,init:4,data_start:5,data_end:15},
  {header:16,contrat:17,init:19,data_start:20,data_end:30},
  {header:31,contrat:32,init:34,data_start:35,data_end:45},
  {header:46,contrat:47,init:49,data_start:50,data_end:60},
];
const XL_JOUR_EMP=[3,17,31,45,59,73];
const XL_EMPS=['EF','LB','NC','SD','VH','AG','LU','EB','GD','FF','VB','AS'];

function tc(hex){
  if(!hex||hex.length<6)return'#000';
  const h=hex.replace('#','');
  const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
  return(0.299*r+0.587*g+0.114*b)/255>0.52?'#1c2b24':'#ffffff';
}

// ═══════════════════════════════════════════════════════════
// STATE
// Stockage calendrier : state.calendar[dateStr] = [[nbH][nbEmp] bool] par jour
// dateStr = 'YYYY-MM-DD' du lundi de la semaine
// state.masque = [{cells:[[...]]}, {cells:[[...]]}] (S1 et S2 de référence)
// currentOffset = index de bloc de 4 semaines depuis masqueStart
// ═══════════════════════════════════════════════════════════
let state={
  employes:[
    {init:'EF',nom:'EF',email:'',heures:33,color:'#B1A0C7',rotation:2,heuresParSemaine:[33,33],actif:true},
    {init:'LB',nom:'LB',email:'',heures:40,color:'#DA9694',rotation:2,heuresParSemaine:[40,40],actif:true},
    {init:'NC',nom:'NC',email:'',heures:30,color:'#00B050',rotation:2,heuresParSemaine:[30,30],actif:true},
    {init:'SD',nom:'SD',email:'',heures:35,color:'#FFC000',rotation:2,heuresParSemaine:[35,35],actif:true},
    {init:'VH',nom:'VH',email:'',heures:10,color:'#CC00CC',rotation:2,heuresParSemaine:[10,10],actif:true},
    {init:'AG',nom:'AG',email:'',heures:35,color:'#FF0000',rotation:2,heuresParSemaine:[35,35],actif:true},
    {init:'LU',nom:'LU',email:'',heures:35,color:'#FFFF00',rotation:2,heuresParSemaine:[35,35],actif:true},
    {init:'EB',nom:'EB',email:'',heures:40,color:'#4F81BD',rotation:2,heuresParSemaine:[40,40],actif:true},
    {init:'GD',nom:'GD',email:'',heures:40,color:'#002060',rotation:2,heuresParSemaine:[40,40],actif:true},
    {init:'FF',nom:'FF',email:'',heures:44,color:'#00FFFF',rotation:2,heuresParSemaine:[44,44],actif:true},
    {init:'VB',nom:'VB',email:'',heures:35,color:'#808080',rotation:2,heuresParSemaine:[35,35],actif:true},
    {init:'AS',nom:'AS',email:'',heures:10,color:'#7030A0',rotation:2,heuresParSemaine:[10,10],actif:true}
  ],
  masque:null,         // [{cells}×2] quinzaine type
  masqueStart:null,    // 'YYYY-MM-DD' du lundi S1 du masque
  calendar:{},         // {dateStr: [[bool×nbEmp]×nbH]} overrides par rapport au masque
  currentBlockStart:null, // 'YYYY-MM-DD' du lundi de S1 du bloc affiché
  params:{nom:'Pharmacie du Marais',phpUrl:'',saveUrl:'',subject:'Planning de la semaine — Pharmacie de Lempdes',intro:'',open:9,close:19,password:DEFAULT_PWD,password2:'',viewPassword:'0000',showTuto:true},
  log:[]
};

let isAdmin=false;
let isViewer=false;
let isTitulaire=false; // Niveau 3 — accès Mnémosyne

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// CODE DE VISUALISATION
// ═══════════════════════════════════════════════════════════
function demandCodeVisu(){
  // Vérifier si un code valide est déjà mémorisé
  const saved = localStorage.getItem('pharmaAccessLevel');
  if(saved === 'viewer'){
    isViewer = true; isAdmin = false;
    // Masquer la modal si elle est affichée
    const m = document.getElementById('modalVisu');
    if(m) m.classList.remove('open');
    _enterViewMode();
    return;
  }
  if(saved === 'titulaire'){
    isViewer = true; isAdmin = true; isTitulaire = true;
    const m = document.getElementById('modalVisu');
    if(m) m.classList.remove('open');
    setAdminMode();
    if(!localStorage.getItem('pharmaHideTutoVisu')) setTimeout(()=>openModal('modalTutoVisu'),400);
    return;
  }
  if(saved === 'admin'){
    isViewer = true; isAdmin = true; isTitulaire = false;
    const m = document.getElementById('modalVisu');
    if(m) m.classList.remove('open');
    setAdminMode();
    return;
  }
  // Sinon afficher la modal
  const modal = document.getElementById('modalVisu');
  if(modal){
    modal.classList.add('open');
    setTimeout(()=>document.getElementById('visuPinInput')?.focus(), 200);
  }
}

function checkVisuPin(){
  const val = document.getElementById('visuPinInput').value;
  const viewPwd = state.params.viewPassword || '0000';
  // Niveau 1 uniquement — code visu
  if(val === viewPwd){
    document.getElementById('modalVisu').classList.remove('open');
    isViewer=true; isAdmin=false; isTitulaire=false;
    localStorage.setItem('pharmaAccessLevel','viewer');
    _enterViewMode();
    return;
  }
  document.getElementById('visuPinError').textContent = 'Code incorrect';
  document.getElementById('visuPinInput').value='';
  document.getElementById('visuPinInput').focus();
  setTimeout(()=>document.getElementById('visuPinError').textContent='', 2000);
}

function _enterViewMode(){
  document.getElementById('modeBadge').className='mode-badge view';
  document.getElementById('modeBadge').textContent='🔒 Admin';
  document.getElementById('mainNav').classList.add('hidden');
  document.getElementById('adminBarBtns').style.display='none';
  document.getElementById('zoomControls').style.display='flex';
  document.getElementById('btnNotif').style.display='inline-flex';
  const wrap=document.getElementById('planningWrap');
  wrap.classList.remove('admin-mode');wrap.style.height='';
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-planning').classList.add('active');
  goToday();
  // Recalculer le scale après rendu complet du DOM
  setTimeout(()=>applyAutoScale(), 100);
  // Tuto visu au premier accès
  if(!localStorage.getItem('pharmaHideTutoVisu')) setTimeout(()=>openModal('modalTutoVisu'),400);
}


// ═══════════════════════════════════════════════════════════
// SAUVEGARDES
// ═══════════════════════════════════════════════════════════
async function sauvegarderMaintenant(){
  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  // type=manual pour distinguer des sauvegardes auto
  const status=document.getElementById('backupStatus');
  status.innerHTML='⏳ Sauvegarde en cours…';
  try{
    const r=await fetch(saveUrl+'cron_backup.php?token=pharmacie-lempdes-cron-2026&action=backup&type=manual');
    const d=await r.json();
    if(d.ok){
      status.innerHTML=`<span style="color:var(--ok)">✅ ${d.file} (${d.size} Ko)</span>`;
      listerSauvegardes();
    }else{
      status.innerHTML=`<span style="color:var(--alerte)">❌ ${d.error||'Erreur'}</span>`;
    }
  }catch(e){
    status.innerHTML=`<span style="color:var(--alerte)">❌ ${e.message}</span>`;
  }
}

async function listerSauvegardes(){
  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  const el=document.getElementById('backupList');
  el.innerHTML='⏳ Chargement…';
  try{
    const r=await fetch(saveUrl+'cron_backup.php?token=pharmacie-lempdes-cron-2026&action=list');
    const d=await r.json();
    if(!d.backups||d.backups.length===0){el.innerHTML='<p style="color:var(--gris);font-size:.78rem">Aucune sauvegarde disponible.</p>';return;}
    el.innerHTML=d.backups.map(b=>`
      <div class="hist-card">
        <div>
          <div style="font-weight:700;font-size:.84rem">${b.auto?'🕐 Auto':'💾 Manuel'} — ${b.date}</div>
          <div style="font-size:.72rem;color:var(--gris)">${b.size} Ko</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="restaurerSauvegarde('${b.file}')">↩ Restaurer</button>
      </div>`).join('');
  }catch(e){
    el.innerHTML=`<span style="color:var(--alerte);font-size:.78rem">❌ ${e.message}</span>`;
  }
}

async function restaurerSauvegarde(file){
  if(!confirm("Restaurer la sauvegarde "+file+" ? Toutes les données actuelles seront remplacées."))return;
  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  const status=document.getElementById('backupStatus');
  status.innerHTML='⏳ Restauration en cours…';
  try{
    const r=await fetch(saveUrl+'cron_backup.php?token=pharmacie-lempdes-cron-2026&action=restore&file='+encodeURIComponent(file));
    const d=await r.json();
    if(d.ok){
      status.innerHTML='<span style="color:var(--ok)">✅ Restauration réussie — rechargement…</span>';
      setTimeout(()=>location.reload(),1500);
    }else{
      status.innerHTML='<span style="color:var(--alerte)">❌ '+(d.error||'Erreur')+'</span>';
    }
  }catch(e){
    status.innerHTML='<span style="color:var(--alerte)">❌ '+e.message+'</span>';
  }
}

function toggleTutoVisu(cb){
  localStorage.setItem('pharmaHideTutoVisu', cb.checked?'1':'');
}

function toggleTuto(cb){
  state.params.showTuto=!cb.checked;
  saveState();
}

function openModalNotif(){
  const sel=document.getElementById('notifEmpSelectModal');
  sel.innerHTML='<option value="">-- Vos initiales --</option>'+
    state.employes.map(e=>`<option value="${e.init}" data-nom="${e.nom}">${e.init} — ${e.nom}</option>`).join('');
  updateNotifBtnModal();
  openModal('modalNotif');
}

async function updateNotifBtnModal(){
  const btn=document.getElementById('notifBtnModal');
  const status=document.getElementById('notifStatusModal');
  if(!btn)return;
  if(!('Notification' in window)){btn.textContent='Non supporté';btn.disabled=true;return;}
  if(Notification.permission==='granted'&&_swReg){
    const sub=await _swReg.pushManager.getSubscription();
    if(sub){
      btn.textContent='🔕 Désactiver les notifications';
      btn.className='notif-btn active';
      if(status)status.textContent='✅ Notifications activées sur cet appareil';
      return;
    }
  }
  btn.textContent='🔔 Activer les notifications';
  btn.className='notif-btn';
  if(status)status.textContent='';
}

async function toggleNotificationsModal(){
  if(!_swReg){showToast('Service worker non disponible',true);return;}
  const sub=await _swReg.pushManager.getSubscription();
  if(sub){
    await sub.unsubscribe();
    const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
    await fetch(saveUrl+'push_subscribe.php',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
    showToast('Notifications désactivées');updateNotifBtnModal();return;
  }
  const perm=await Notification.requestPermission();
  if(perm!=='granted'){showToast('Permission refusée',true);return;}
  const sel=document.getElementById('notifEmpSelectModal');
  const empInit=sel?.value;
  const empNom=sel?.options[sel.selectedIndex]?.dataset?.nom||empInit;
  if(!empInit){showToast("Choisissez vos initiales d'abord",true);return;}
  try{
    const newSub=await _swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
    const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
    const r=await fetch(saveUrl+'push_subscribe.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empInit,empNom,subscription:newSub.toJSON()})});
    const d=await r.json();
    if(d.ok){showToast('🔔 Notifications activées !');updateNotifBtnModal();}
    else showToast('Erreur: '+(d.error||'?'),true);
  }catch(e){showToast('Erreur: '+e.message,true);}
}

// PWA - SERVICE WORKER
// ═══════════════════════════════════════════════════════════
const VAPID_PUBLIC_KEY = 'BKySLD-u399tKndYn9Zz6jRPtsC7ASaDKL_1dy5TJ7iwvRi4H57lixfRemzy4D4hHo0kYGy-lwxwrSoJWhxFcGg';

let _swReg = null;
let _deferredInstall = null;

async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js');
    console.log('SW enregistré');
  } catch(e) { console.warn('SW échoué:', e); }
}

// ── Installation PWA ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'inline-flex';
});

async function installPWA() {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  const result = await _deferredInstall.userChoice;
  if (result.outcome === 'accepted') {
    document.getElementById('installBtn').style.display = 'none';
    _deferredInstall = null;
    showToast('Appli installée ! 📱');
  }
}

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').style.display = 'none';
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS PUSH
// ═══════════════════════════════════════════════════════════
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function initNotifSection() {
  // Remplir le select employés
  const sel = document.getElementById('notifEmpSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choisissez vos initiales --</option>' +
    state.employes.map(e => `<option value="${e.init}" data-nom="${e.nom}">${e.init} — ${e.nom}</option>`).join('');

  // Statut actuel
  updateNotifBtn();
}

async function updateNotifBtn() {
  const btn = document.getElementById('notifBtn');
  const status = document.getElementById('notifStatus');
  if (!btn) return;

  if (!('Notification' in window)) {
    btn.textContent = '❌ Non supporté sur ce navigateur';
    btn.disabled = true;
    return;
  }

  if (Notification.permission === 'granted' && _swReg) {
    const sub = await _swReg.pushManager.getSubscription();
    if (sub) {
      btn.textContent = '🔕 Désactiver les notifications';
      btn.className = 'notif-btn active';
      if (status) status.textContent = '✅ Notifications activées sur cet appareil';
      return;
    }
  }
  btn.textContent = '🔔 Activer les notifications';
  btn.className = 'notif-btn';
  if (status) status.textContent = '';
}

async function toggleNotifications() {
  if (!_swReg) { showToast('Service worker non disponible', true); return; }
  const sub = await _swReg.pushManager.getSubscription();
  if (sub) {
    // Désabonner
    await sub.unsubscribe();
    const saveUrl = state.params.saveUrl?.replace('save.php','') || '/';
    await fetch(saveUrl + 'push_subscribe.php', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({endpoint: sub.endpoint})
    }).catch(()=>{});
    showToast('Notifications désactivées');
    updateNotifBtn();
    return;
  }

  // Demander permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { showToast('Permission refusée', true); return; }

  const sel = document.getElementById('notifEmpSelect');
  const empInit = sel?.value;
  const empNom = sel?.options[sel.selectedIndex]?.dataset?.nom || empInit;
  if (!empInit) { showToast("Choisissez vos initiales d'abord", true); return; }

  try {
    const sub = await _swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const saveUrl = state.params.saveUrl?.replace('save.php','') || '/';
    const r = await fetch(saveUrl + 'push_subscribe.php', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({empInit, empNom, subscription: sub.toJSON()})
    });
    const d = await r.json();
    if (d.ok) {
      showToast('🔔 Notifications activées !');
      updateNotifBtn();
    } else {
      showToast('Erreur: ' + (d.error||'?'), true);
    }
  } catch(e) {
    showToast('Erreur: ' + e.message, true);
  }
}


// ═══════════════════════════════════════════════════════════
// RÉCAP MENSUEL
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// RÉCAP MENSUEL INTERACTIF
// ═══════════════════════════════════════════════════════════
const MOTIFS = ['—','Vacances','Heures sup','Récupération','Échange','Formation','Maladie','Autre'];

function initRecap(){
  const now=new Date();
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('recapMois').value=`${y}-${m}`;
}

function getJustifKey(mois,empInit,semLabel){
  return `${mois}|${empInit}|${semLabel}`;
}

function saveJustif(mois,empInit,semLabel,motif){
  if(!state.justifications)state.justifications={};
  const key=getJustifKey(mois,empInit,semLabel);
  if(motif==='—')delete state.justifications[key];
  else state.justifications[key]=motif;
  saveState();
}



function genererRecapInteractif(){
  const mois=document.getElementById('recapMois').value;
  if(!mois){showToast('Choisissez un mois',true);return;}

  const [annee,moisNum]=mois.split('-').map(Number);
  const premierJour=new Date(annee,moisNum-1,1);
  const dernierJour=new Date(annee,moisNum,0);
  const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisLabel=moisNoms[moisNum-1]+' '+annee;

  document.getElementById('recapTitre').textContent='📊 '+moisLabel;

  // Trouver les semaines
  const semaines=[];
  let cur=new Date(premierJour);
  while(cur.getDay()!==1)cur=new Date(cur.getTime()-86400000);
  while(cur<=dernierJour){semaines.push(new Date(cur));cur=new Date(cur.getTime()+7*86400000);}

  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const emps=state.employes.filter(e=>e.actif!==false);
  const joursF=['Lun','Mar','Mer','Jeu','Ven','Sam'];

  // Construire données
  const data=emps.map(emp=>{
    const sems=semaines.map(lundi=>{
      const lundoStr=dateToStr(lundi);
      const semFin=new Date(lundi.getTime()+5*86400000);
      const label=lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' → '+semFin.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});

      let he=0,hnMois=0,absJours=[];
      for(let j=0;j<6;j++){
        const d=new Date(lundi.getTime()+j*86400000);
        const ds=dateToStr(d);
        if(d<premierJour||d>dernierJour)continue;
        let hJour=0,hnJour=0;
        for(let h=0;h<nbH;h++){
          if(getCell(ds,h,emp.init))hJour++;
          if(getMasqueCell(ds,h,emp.init))hnJour++;
        }
        he+=hJour;hnMois+=hnJour;
        if(hnJour>0&&hJour===0)absJours.push(joursF[j]);
      }
      const ecart=he-hnMois;
      // Heures sup structurelles (Hn masque - H contrat)
      const sIdx=getSemaineIndex(dateToStr(lundi));
      const hc=getHeuresContrat_contrat(emp,sIdx);
      const hSupStruct=hnMois-hc;
      return {label,he,hn:hnMois,ecart,absJours,hc,hSupStruct};
    }).filter(s=>s.ecart!==0); // N'afficher que les semaines avec écart

    const totalHe=sems.reduce((t,s)=>t+s.he,0);
    const totalHn=sems.reduce((t,s)=>t+s.hn,0);
    return {emp,sems,totalHe,totalHn,ecartTotal:totalHe-totalHn};
  }).filter(row=>{
    if(row.sems.length>0)return true;
    // Inclure si H.sup structurelles ce mois
    const emp=row.emp;
    const rot=emp.rotation||2;
    const hps=emp.heuresParSemaine||[emp.heures||35];
    const hcs=emp.heuresContrat||hps;
    for(let si=0;si<rot;si++){if((hps[si]||35)>(hcs[si]||hps[si]||35))return true;}
    return false;
  });

  // Construire tableau HTML interactif
  let html=`<table style="border-collapse:collapse;width:100%;font-size:.75rem">
    <thead>
      <tr style="background:#1a4a34;color:#fff">
        <th style="padding:8px 10px;text-align:left;border:1px solid #0f3323;min-width:100px">Salarié</th>
        <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323;min-width:90px">Semaine</th>
        <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323">He</th>
        <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323">Hn</th>
        <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323">H.Sup struct.</th>
        <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323">Écart</th>
        <th style="padding:8px 6px;text-align:left;border:1px solid #0f3323;min-width:140px">Motif</th>
        <th style="padding:8px 6px;text-align:left;border:1px solid #0f3323;min-width:100px">Absences</th>
      </tr>
    </thead><tbody>`;

  data.forEach(row=>{
    const {emp,sems,totalHe,totalHn,ecartTotal}=row;
    const nbRows=Math.max(sems.length,1);
    const ecartC=ecartTotal>0?'#1e8449':ecartTotal<0?'#c0392b':'#6b7280';
    const empBadge=`<span style="background:${emp.color};color:${tc(emp.color)};padding:2px 7px;border-radius:4px;font-weight:700;font-size:.72rem">${emp.init}</span>`;

    // Calculer H.sup structurelles du mois
    const rot=emp.rotation||2;
    const hps=emp.heuresParSemaine||[emp.heures||35];
    const hcs=emp.heuresContrat||hps;
    let hSupStructMois=0;
    // Lire le planning réel jour par jour pour les H.sup structurelles
    const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
    semaines.forEach(lundi=>{
      const samedi=new Date(lundi.getTime()+5*86400000);
      if(lundi>dernierJour)return;
      if(samedi<premierJour)return;
      const sIdx=getSemaineIndex(dateToStr(lundi));
      const idx=((sIdx%rot)+rot)%rot;
      const hnSem=hps[idx]||35;
      const hcSem=hcs[idx]||hnSem;
      if(hcSem>=hnSem)return; // Pas de H.sup structurelles
      // H.sup struct. = masque - contrat, lues jour par jour dans le mois
      for(let j=0;j<6;j++){
        const dj=new Date(lundi.getTime()+j*86400000);
        if(dj<premierJour||dj>dernierJour)continue;
        const ds=dateToStr(dj);
        // Heures masque ce jour
        let hnJour=0;
        for(let h=0;h<nbH;h++) if(getMasqueCell(ds,h,emp.init))hnJour++;
        // Heures contrat ce jour (prorata H.contrat/H.masque × heures masque du jour)
        const hcJour=hnSem>0?(hcSem/hnSem)*hnJour:0;
        const supJour=hnJour-hcJour;
        if(supJour>0) hSupStructMois+=supJour;
      }
    });
    hSupStructMois=Math.round(hSupStructMois*2)/2; // Arrondi à la demi-heure

    if(sems.length===0&&hSupStructMois===0){
      return; // Rien à afficher
    }

    if(sems.length===0){
      // Seulement H.sup structurelles, pas d'écart ponctuel
      html+=`<tr>
        <td style="padding:6px 10px;border:1px solid #d1e3da;vertical-align:middle">
          ${empBadge}<br><span style="font-size:.72rem;color:#374151">${emp.nom||emp.init}</span>
        </td>
        <td colspan="5" style="padding:6px;border:1px solid #d1e3da;color:var(--gris);font-size:.72rem;text-align:center">Aucun écart ponctuel</td>
        <td style="padding:6px 8px;border:1px solid #d1e3da;text-align:center;font-weight:700;color:#e67e22;font-size:.74rem">
          +${hSupStructMois}h sup struct.
        </td>
      </tr>`;
      return;
    }

    sems.forEach((sem,si)=>{
      const justifKey=getJustifKey(mois,emp.init,sem.label);
      const justif=getJustif(mois,emp.init,sem.label);
      const ecC=sem.ecart>0?'#1e8449':sem.ecart<0?'#c0392b':'#6b7280';
      const bgEc=sem.ecart>0?'#d5f5e3':sem.ecart<0?'#fde8e8':'#fff';
      const showMotif=sem.ecart!==0;

      const motifSelect=showMotif?`<select onchange="saveJustif('${mois}','${emp.init}','${sem.label}',this.value)"
        style="font-size:.72rem;padding:2px 4px;border:1.5px solid var(--bordure);border-radius:4px;width:100%">
        ${MOTIFS.map(m=>`<option value="${m}"${m===justif?' selected':''}>${m}</option>`).join('')}
      </select>`:'<span style="color:var(--gris);font-size:.7rem">—</span>';

      html+=`<tr>`;
      if(si===0){
        html+=`<td rowspan="${nbRows}" style="padding:6px 10px;border:1px solid #d1e3da;vertical-align:top">
          ${empBadge}<br><span style="font-size:.72rem;color:#374151">${emp.nom||emp.init}</span>
          <div style="margin-top:4px;font-size:.68rem;font-weight:700;color:${ecartC}">
            Total: ${totalHe}h/${totalHn}h ${ecartTotal!==0?(ecartTotal>0?'+':'')+ecartTotal+'h':'✅'}
          </div>
          ${(()=>{
            const hSupStruct=Math.round(hSupStructMois*2)/2;
            const hSupPonct=Math.max(0,Math.round(ecartTotal*2)/2);
            const hSupTotal=Math.round((hSupStruct+hSupPonct)*2)/2;
            if(hSupTotal===0)return '';
            return '<div style="margin-top:3px;font-size:.65rem;border-top:1px solid #eee;padding-top:3px">'
              +(hSupStruct>0?`<span style="color:#e67e22;font-weight:700">Struct: +${hSupStruct}h</span> `:'')
              +(hSupPonct>0?`<span style="color:#c0392b;font-weight:700">Ponct: +${hSupPonct}h</span> `:'')
              +`<span style="color:#1a6b4a;font-weight:700">= +${hSupTotal}h sup</span></div>`;
          })()}</td>`;
      }
      html+=`<td style="padding:5px 6px;border:1px solid #d1e3da;font-size:.7rem">${sem.label}</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da;text-align:center;font-weight:700;color:#1a6b4a">${sem.he}h</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da;text-align:center;color:#6b7280">${sem.hn}h</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da;text-align:center;color:#e67e22;font-size:.7rem">${sem.hSupStruct>0?'+'+sem.hSupStruct+'h sup':'—'}</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da;text-align:center;background:${bgEc};font-weight:700;color:${ecC}">
          ${sem.ecart!==0?(sem.ecart>0?'+':'')+sem.ecart+'h':'—'}</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da">${motifSelect}</td>
        <td style="padding:5px 6px;border:1px solid #d1e3da;font-size:.68rem;color:#c0392b">
          ${sem.absJours.length>0?sem.absJours.join(', '):'—'}</td>
      </tr>`;
    });
  });

  html+=`</tbody></table>`;

  document.getElementById('recapTableau').innerHTML=html;
  document.getElementById('recapInteractif').style.display='block';
}

async function envoyerRecap(){
  const mois=document.getElementById('recapMois').value;
  if(!mois){showToast('Choisissez un mois',true);return;}
  if(!confirm('Envoyer le récapitulatif au comptable ?'))return;
  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  const status=document.getElementById('recapStatus');
  status.innerHTML='⏳ Envoi en cours…';

  // Inclure les justifications dans la requête
  const justifs=state.justifications||{};
  try{
    const r=await fetch(saveUrl+`cron_recap.php?token=pharmacie-lempdes-cron-2026&mode=send&mois=${mois}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({justifications:justifs})
    });
    const d=await r.json();
    if(d.ok){
      status.innerHTML=`<span style="color:var(--ok)">✅ Récapitulatif ${d.mois} envoyé !</span>`;
      showToast('✅ Récap envoyé !');
    }else{
      status.innerHTML=`<span style="color:var(--alerte)">❌ ${d.error||'Erreur'}</span>`;
    }
  }catch(e){
    status.innerHTML=`<span style="color:var(--alerte)">❌ ${e.message}</span>`;
  }
}

function initRecap_old(){
  // Pré-remplir avec le mois en cours
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('recapMois').value=`${y}-${m}`;
}

async function previewRecap(){
  const mois=document.getElementById('recapMois').value;
  if(!mois){showToast('Choisissez un mois',true);return;}
  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  const status=document.getElementById('recapStatus');
  status.innerHTML='⏳ Génération en cours…';
  try{
    const r=await fetch(saveUrl+`cron_recap.php?mode=preview&mois=${mois}`,{
      headers:{'Authorization':'Bearer pharmacie-lempdes-cron-2026'}
    });
    if(!r.ok)throw new Error('Erreur serveur');
    const html=await r.text();
    document.getElementById('recapPreviewFrame').innerHTML=html;
    document.getElementById('recapPreviewCard').style.display='block';
    status.innerHTML='';
  }catch(e){
    status.innerHTML=`<span style="color:var(--alerte)">❌ ${e.message}</span>`;
  }
}

// ═══════════════════════════════════════════════════════════
// MASQUE ACTUEL — AFFICHAGE
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// RENDU MASQUE — S1 puis S2 en vertical
// ═══════════════════════════════════════════════════════════
function renderMasqueTable(masqueData, containerId){
  const el=document.getElementById(containerId);
  if(!el||!masqueData)return;
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const emps=state.employes.filter(e=>e.actif!==false);
  const JOURS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const SEM_BG=['#1a4a34','#1a3a5c'];
  let html='';

  for(let si=0;si<masqueData.length;si++){
    const sbg=SEM_BG[si%2];
    html+=`<div style="margin-bottom:8px">`;
    html+=`<table style="border-collapse:collapse;width:100%;font-size:.68rem">`;

    // En-tête semaine
    const totalCols=6*emps.length+5;
    html+=`<tr><td style="background:${sbg};color:#fff;font-weight:700;padding:4px 8px;font-size:.75rem" colspan="${totalCols+1}">S${si+1}</td></tr>`;

    // En-tête jours
    html+='<tr><td style="background:#f0f4f2;min-width:30px;padding:2px 4px;font-size:.6rem;color:#555;font-weight:700">H</td>';
    for(let j=0;j<6;j++){
      html+=`<th colspan="${emps.length}" style="background:${sbg};color:#fff;padding:3px 2px;text-align:center;font-size:.65rem;border:1px solid rgba(255,255,255,.2)">${JOURS[j].substring(0,3)}</th>`;
      if(j<5)html+='<td style="width:2px;background:#888"></td>';
    }
    html+='</tr>';

    // Initiales
    html+='<tr><td style="background:#f0f4f2"></td>';
    for(let j=0;j<6;j++){
      emps.forEach(e=>html+=`<td style="background:${e.color};color:${tc(e.color)};text-align:center;padding:1px;font-weight:700;font-size:.58rem;border:1px solid rgba(0,0,0,.1)">${e.init}</td>`);
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';

    // Lignes Hn et He sous les initiales (sous le mot Lundi)
    const hnSem=emps.map((e)=>{
      const globalEi=state.employes.findIndex(emp=>emp.init===e.init);
      let hn=0;
      for(let jj=0;jj<6;jj++)
        for(let h=0;h<nbH;h++){
          const row=masqueData[si]?.cells[jj]?.[h];
          const on=row?(Array.isArray(row)?row[globalEi]||false:row[e.init]||false):false;
          if(on)hn++;
        }
      return hn;
    });
    // Ligne Hn — fond bleu clair
    html+=`<tr class="r-hnorm"><td class="corner r2" style="font-size:.6rem;background:#dce6f1;color:#17375e;font-weight:700;border:1px solid #aabdd4">Hn</td>`;
    for(let j=0;j<6;j++){
      emps.forEach((e,ei)=>{
        if(j===0) html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#dce6f1;color:#17375e;font-weight:700;text-align:center;border:1px solid #aabdd4">${hnSem[ei]}</td>`;
        else html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#dce6f1;border:1px solid #aabdd4"></td>`;
      });
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';
    // Ligne He — vert si He=Hn, rouge si He≠Hn
    html+=`<tr class="r-heff"><td class="corner r3" style="font-size:.6rem;background:#e2efda;color:#375623;font-weight:700;border:1px solid #9cbf87">He</td>`;
    for(let j=0;j<6;j++){
      emps.forEach((e,ei)=>{
        if(j===0){
          const ok=hnSem[ei]===hnSem[ei]; // He=Hn dans le masque (toujours égaux)
          html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#1e8449;color:#fff;font-weight:700;text-align:center;border:1px solid #9cbf87">${hnSem[ei]}</td>`;
        } else {
          html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#e2efda;border:1px solid #9cbf87"></td>`;
        }
      });
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';

    // Heures
    for(let h=0;h<nbH;h++){
      const bg=h%2===0?'#f9fbfa':'#fff';
      html+=`<tr><td style="background:#f0f4f2;padding:1px 4px;font-weight:700;color:#555;font-size:.62rem;text-align:right;white-space:nowrap">${open+h}h</td>`;
      for(let j=0;j<6;j++){
        emps.forEach((e,ei)=>{
          const row=masqueData[si]?.cells[j]?.[h];
          const on=row?(Array.isArray(row)?row[ei]||false:row[e.init]||false):false;
          html+=`<td style="width:16px;min-width:16px;max-width:16px;height:13px;background:${on?e.color:bg};border:1px solid #eee"></td>`;
        });
        if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
      }
      html+='</tr>';
    }



    html+='</table></div>';
  }
  el.innerHTML='<div style="display:inline-block;text-align:left">'+html+'</div>';
}

function renderMasqueActuel(){
  const info=document.getElementById('masqueActuelInfo');
  const preview=document.getElementById('masqueActuelPreview');
  if(!info||!preview)return;

  if(!state.masque||!state.masqueStart){
    info.textContent='Aucun masque chargé';
    preview.innerHTML='<div class="empty" style="padding:.8rem"><p>Importez ou créez un masque.</p></div>';
    return;
  }

  const d=strToDate(state.masqueStart);
  info.textContent='Depuis le '+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  const btnMod=document.getElementById('btnModifierMasque');
  if(btnMod)btnMod.style.display='inline-flex';
  const btnImp=document.getElementById('btnImprimerMasque');
  if(btnImp)btnImp.style.display='inline-flex';
  const ph=document.getElementById('btnModifierMasquePlaceholder');
  if(ph)ph.style.display='none';
  preview.innerHTML='<div id="masqueActuelTable"></div>';
  renderMasqueTable(state.masque,'masqueActuelTable');
}

// ═══════════════════════════════════════════════════════════
// PROJET DE MASQUE
// ═══════════════════════════════════════════════════════════
let _projetMasque = null; // masque en cours d'édition

function ouvrirProjetMasqueVide(nom){
  nom=nom||'Nouveau masque';
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open,nbEmp=state.employes.length;
  // Créer un masque vide (2 semaines × 6 jours × nbH × nbEmp)
  _projetMasque = {
    nom: nom,
    modeEdit: 'nouveau',
    masque: [
      {cells: Array.from({length:6},()=>Array.from({length:nbH},()=>new Array(nbEmp).fill(false)))},
      {cells: Array.from({length:6},()=>Array.from({length:nbH},()=>new Array(nbEmp).fill(false)))}
    ],
    masqueStart: state.masqueStart || dateToStr(new Date()),
    source: 'zero'
  };
  document.getElementById('projetMasqueEditorInfo').textContent=nom;
  document.getElementById('btnValiderProjetMasque').textContent='✅ Créer le projet de masque';
  if(document.getElementById('btnAnnulerProjetMasque'))document.getElementById('btnAnnulerProjetMasque').textContent='✕ Annuler';
  document.getElementById('projetMasqueCard').style.display='none';
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetMasqueEditor').style.display='block';
  renderProjetMasquePreview();
}

async function importerProjetMasque(input){
  const file=input.files[0];if(!file)return;input.value='';

  // Demander la date de début
  const dateStr=prompt('Date du lundi de début du masque (YYYY-MM-DD) :',
    state.masqueStart||dateToStr(new Date()));
  if(!dateStr)return;

  const prog=document.getElementById('importProgress');
  const actions=document.getElementById('importActions');
  if(prog){prog.innerHTML='<div>⏳ Lecture du masque…</div>';actions.style.display='none';openModal('modalImport');}

  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true,raw:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
      const open=state.params.open||9,close=state.params.close||19,nbH=close-open,nbEmp=state.employes.length;

      const masqueSemaines=[];
      const XL_SEM=[
        {data_start:5,data_end:15},
        {data_start:20,data_end:30},
      ];
      const XL_JOUR_EMP=[3,17,31,45,59,73];
      const XL_EMPS=['EF','LB','NC','SD','VH','AG','LU','EB','GD','FF','VB','AS'];

      for(let si=0;si<2;si++){
        const semDef=XL_SEM[si],cells=[];
        for(let ji=0;ji<6;ji++){
          const jourCells=[];
          for(let h=0;h<nbH;h++){
            const row=raw[semDef.data_start+h]||[],hArr=new Array(nbEmp).fill(false);
            const hObj={};
            for(let ei=0;ei<nbEmp;ei++){
              const emp=state.employes[ei],xlEi=XL_EMPS.indexOf(emp.init);
              if(xlEi===-1)continue;
              const val=row[XL_JOUR_EMP[ji]+xlEi];
              hObj[emp.init]=!!(val&&String(val).trim()!=='');
            }
            jourCells.push(hObj);
          }
          cells.push(jourCells);
        }
        masqueSemaines.push({cells});
      }

      _projetMasque={masque:masqueSemaines,masqueStart:dateStr,source:'excel'};
      if(prog){prog.innerHTML+='<div>✅ Masque importé — vérifiez puis validez.</div>';actions.style.display='flex';}
      document.getElementById('projetMasqueEditorInfo').textContent='Importé depuis Excel — début le '+strToDate(dateStr).toLocaleDateString('fr-FR');
      document.getElementById('projetMasqueCard').style.display='none';
      document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetMasqueEditor').style.display='block';
      renderProjetMasquePreview();
      if(prog)closeModal('modalImport');
    }catch(err){
      if(prog){prog.innerHTML+=`<div style="color:var(--alerte)">❌ ${err.message}</div>`;actions.style.display='flex';}
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderProjetMasquePreview(){
  const el=document.getElementById('projetMasquePreview');
  if(!el||!_projetMasque)return;
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const emps=state.employes.filter(e=>e.actif!==false);
  const JOURS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const SEM_BG=['#1a4a34','#1a3a5c'];
  let html='<div style="display:inline-block;text-align:left">';

  for(let si=0;si<2;si++){
    const sbg=SEM_BG[si];
    html+=`<div style="margin-bottom:8px"><table style="border-collapse:collapse;font-size:.62rem;white-space:nowrap">`;
    html+=`<tr><td style="background:${sbg};color:#fff;font-weight:700;padding:4px 8px;font-size:.75rem" colspan="${6*emps.length+6}">S${si+1}</td></tr>`;
    html+='<tr><td style="background:#f0f4f2;min-width:30px;padding:2px 4px;font-size:.6rem;color:#555;font-weight:700">H</td>';
    for(let j=0;j<6;j++){
      html+=`<th colspan="${emps.length}" style="background:${sbg};color:#fff;padding:3px 2px;text-align:center;font-size:.65rem;border:1px solid rgba(255,255,255,.2)">${JOURS[j].substring(0,3)}</th>`;
      if(j<5)html+='<td style="width:2px;background:#888"></td>';
    }
    html+='</tr><tr><td style="background:#f0f4f2"></td>';
    for(let j=0;j<6;j++){
      emps.forEach(e=>html+=`<td style="background:${e.color};color:${tc(e.color)};text-align:center;padding:1px;font-weight:700;font-size:.58rem;border:1px solid rgba(0,0,0,.1)">${e.init}</td>`);
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';

    // Hn = heures contrat, He = heures effectives dans le projet masque
    const heSem=emps.map(e=>{
      const globalEi=state.employes.findIndex(emp=>emp.init===e.init);
      let he=0;
      for(let jj=0;jj<6;jj++)
        for(let h=0;h<nbH;h++){
          const row=_projetMasque.masque[si]?.cells[jj]?.[h];
          const on=row?(Array.isArray(row)?row[globalEi]||false:row[e.init]||false):false;
          if(on)he++;
        }
      return he;
    });
    // Ligne Hn (contrat)
    html+=`<tr><td style="background:#dce6f1;color:#17375e;font-weight:700;font-size:.6rem;padding:1px 4px;border:1px solid #aabdd4">Hn</td>`;
    for(let j=0;j<6;j++){
      emps.forEach((e,ei)=>{
        if(j===0){
          const hn=getHeuresContrat(e,si);
          html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#dce6f1;color:#17375e;font-weight:700;text-align:center;border:1px solid #aabdd4">${hn}</td>`;
        } else html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#dce6f1;border:1px solid #aabdd4"></td>`;
      });
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';
    // Ligne He (effectif) — vert si He=Hn, rouge si différent
    html+=`<tr><td style="background:#e2efda;color:#375623;font-weight:700;font-size:.6rem;padding:1px 4px;border:1px solid #9cbf87">He</td>`;
    for(let j=0;j<6;j++){
      emps.forEach((e,ei)=>{
        if(j===0){
          const hn=getHeuresContrat(e,si);
          const he=heSem[ei];
          const bg=he===hn?'#1e8449':'#c0392b';
          html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:${bg};color:#fff;font-weight:700;text-align:center;border:1px solid #9cbf87">${he}</td>`;
        } else html+=`<td style="font-size:.6rem;width:16px;min-width:16px;background:#e2efda;border:1px solid #9cbf87"></td>`;
      });
      if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
    }
    html+='</tr>';

    for(let h=0;h<nbH;h++){
      const bg=h%2===0?'#f9fbfa':'#fff';
      html+=`<tr><td style="background:#f0f4f2;padding:1px 4px;font-weight:700;color:#555;font-size:.62rem;text-align:right;white-space:nowrap">${open+h}h</td>`;
      for(let j=0;j<6;j++){
        emps.forEach(e=>{
          const row=_projetMasque.masque[si]?.cells[j]?.[h];
          const on=row?(Array.isArray(row)?row[state.employes.indexOf(e)]||false:row[e.init]||false):false;
          html+=`<td onclick="toggleProjetMasqueCell(${si},${j},${h},'${e.init}')"
            style="width:16px;min-width:16px;max-width:16px;height:16px;background:${on?e.color:bg};
            border:1px solid #eee;cursor:pointer" title="${on?'Présent':'Absent'} — clic pour basculer"></td>`;
        });
        if(j<5)html+='<td style="width:2px;background:#ccc"></td>';
      }
      html+='</tr>';
    }
    html+='</table></div>';
  }
  html+='</div>';
  el.innerHTML=html;
}

function toggleProjetMasqueCell(si,ji,h,init){
  if(!_projetMasque)return;
  const cells=_projetMasque.masque[si].cells[ji];
  if(!cells[h])cells[h]={};
  if(Array.isArray(cells[h])){
    const newRow={};
    cells[h].forEach((v,ei)=>{if(state.employes[ei])newRow[state.employes[ei].init]=v;});
    cells[h]=newRow;
  }
  cells[h][init]=!cells[h][init];
  renderProjetMasquePreview();
}

function ouvrirModificationMasque(){
  if(!state.masque){showToast('Aucun masque à modifier',true);return;}
  // Copie du masque actuel pour édition
  _projetMasque={
    masque:JSON.parse(JSON.stringify(state.masque)),
    masqueStart:state.masqueStart,
    source:'modification'
  };
  _projetMasque.nom='Modification masque actuel';
  _projetMasque.modeEdit='modification';
  document.getElementById('projetMasqueEditorInfo').textContent='Modification du masque actuel';
  document.getElementById('btnValiderProjetMasque').textContent='✅ Enregistrer les modifications';
  document.getElementById('btnAnnulerProjetMasque').textContent='✕ Annuler les modifications';
  document.getElementById('projetMasqueCard').style.display='none';
  document.getElementById('masqueActuelCard').style.display='none';
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetMasqueEditor').style.display='block';
  renderProjetMasquePreview();
}

function annulerProjetMasque(){
  // Si modification en cours, restaurer le projet original
  if(_projetMasque&&_projetMasque._backup){
    state.projetsMasque.splice(_projetMasque._backupIdx,0,_projetMasque._backup);
    saveState();
    renderProjetsMasqueListe();
  }
  _projetMasque=null;
  document.getElementById('projetMasqueEditor').style.display='none';
  document.getElementById('projetMasqueCard').style.display='block';
  document.getElementById('masqueActuelCard').style.display='block';
  document.getElementById('projetsListView').style.display='block';
}

function validerProjetMasque(){
  if(!_projetMasque){showToast('Aucun masque en cours',true);return;}
  // Créer un projet de masque en attente (pas de publication directe)
  if(!state.projetsMasque)state.projetsMasque=[];
  const nom=_projetMasque.nom||'Nouveau masque';
  const projet={
    id:Date.now(),
    nom:nom,
    date:new Date().toISOString(),
    masque:JSON.parse(JSON.stringify(_projetMasque.masque)),
    masqueStart:_projetMasque.masqueStart,
    statut:'brouillon'
  };
  state.projetsMasque.unshift(projet);
  if(state.projetsMasque.length>5)state.projetsMasque=state.projetsMasque.slice(0,5);
  _projetMasque=null;
  saveState();
  document.getElementById('projetMasqueEditor').style.display='none';
  document.getElementById('projetMasqueCard').style.display='block';
  document.getElementById('masqueActuelCard').style.display='block';
  renderProjetsMasqueListe();
  showToast('✅ Projet de masque créé — à publier quand prêt');
}


// ═══════════════════════════════════════════════════════════
// PROJETS DE MASQUE
// ═══════════════════════════════════════════════════════════

// ── Demander le nom avant de créer un projet de masque ──
let _typeProjetMasque=null;
function demanderNomProjetMasque(type){
  _typeProjetMasque=type;
  document.getElementById('inputNomProjetMasque').value='';
  if(type==='excel'){
    // Pour Excel, demander le nom puis ouvrir le file input
    openModal('modalNomProjetMasque');
  } else {
    openModal('modalNomProjetMasque');
  }
}

function confirmerNomProjetMasque(){
  const nom=document.getElementById('inputNomProjetMasque').value.trim();
  if(!nom){showToast('Entrez un nom pour le projet',true);return;}
  closeModal('modalNomProjetMasque');
  if(_typeProjetMasque==='zero'){
    ouvrirProjetMasqueVide(nom);
  } else if(_typeProjetMasque==='actuel'){
    ouvrirProjetMasqueDepuisActuel(nom);
  } else if(_typeProjetMasque==='excel'){
    window._nomProjetMasqueEnCours=nom;
    document.getElementById('masqueProjetInput').click();
  }
  _typeProjetMasque=null;
}

function ouvrirProjetMasqueDepuisActuel(nom){
  if(!state.masque){showToast('Aucun masque actuel',true);return;}
  _projetMasque={
    nom:nom,
    masque:JSON.parse(JSON.stringify(state.masque)),
    masqueStart:state.masqueStart,
    modeEdit:'nouveau'
  };
  document.getElementById('projetMasqueCard').style.display='none';
  document.getElementById('masqueActuelCard').style.display='none';
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetMasqueEditor').style.display='block';
  document.getElementById('projetMasqueEditorInfo').textContent=nom;
  document.getElementById('btnValiderProjetMasque').textContent='✅ Créer le projet de masque';
  if(document.getElementById('btnAnnulerProjetMasque'))document.getElementById('btnAnnulerProjetMasque').textContent='✕ Annuler';
  renderProjetMasquePreview();
}

function importerProjetMasqueAvecNom(input){
  const nom=window._nomProjetMasqueEnCours||'Nouveau masque';
  window._nomProjetMasqueEnCours=null;
  // Appeler l'import existant puis renommer
  importerProjetMasque(input);
  // Le nom sera appliqué après l'import via _projetMasque
  setTimeout(()=>{
    if(_projetMasque) _projetMasque.nom=nom;
    if(document.getElementById('projetMasqueEditorInfo'))
      document.getElementById('projetMasqueEditorInfo').textContent=nom;
    document.getElementById('btnValiderProjetMasque').textContent='✅ Créer le projet de masque';
  if(document.getElementById('btnAnnulerProjetMasque'))document.getElementById('btnAnnulerProjetMasque').textContent='✕ Annuler';
  },500);
}

function renderProjetsMasqueListe(){
  const el=document.getElementById('projetsMasqueListe');
  if(!el)return;
  const projets=state.projetsMasque||[];
  if(projets.length===0){el.innerHTML='';return;}
  el.innerHTML='<div class="card-title" style="font-size:.8rem;margin-bottom:.5rem;margin-top:.5rem">Projets en attente</div>'
    +projets.map((p,i)=>`
    <div style="border:1px solid var(--bordure);border-radius:8px;padding:.7rem;margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-weight:700;font-size:.84rem">${p.nom}</div>
          <div style="font-size:.7rem;color:var(--gris)">Créé le ${new Date(p.date).toLocaleDateString('fr-FR')}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="modifierProjetMasque(${i})">✏ Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="imprimerProjetMasque(${i})">🖨 Imprimer</button>
          <button class="btn btn-primary btn-sm" onclick="publierProjetMasque(${i})">✅ Publier</button>
          <button class="btn btn-danger btn-sm" onclick="supprimerProjetMasque(${i})">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

async function imprimerProjetMasque(idx){
  const p=state.projetsMasque[idx];
  if(!p)return;
  // Générer un aperçu temporaire
  const tmp=document.createElement('div');
  tmp.style.position='absolute';tmp.style.left='-9999px';
  document.body.appendChild(tmp);
  tmp.id='tmpMasquePreview';
  renderMasqueTable(p.masque,'tmpMasquePreview');
  await new Promise(r=>setTimeout(r,200));
  showToast('Génération en cours...');
  try{
    const canvas=await html2canvas(tmp,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,width:tmp.scrollWidth,height:tmp.scrollHeight+10});
    document.body.removeChild(tmp);
    const imgData=canvas.toDataURL('image/png');
    const printWin=window.open('','_blank');
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${p.nom}</title>
<style>@page{size:A4 landscape;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{width:297mm;height:210mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
.h{font-size:11px;color:#666;margin-bottom:4px;align-self:flex-start;padding-left:4px}img{max-width:297mm;max-height:200mm;object-fit:contain}</style>
</head><body><div class="h">⚕ Pharmacie du Marais — ${p.nom}</div><img src="${imgData}">
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></body></html>`);
    printWin.document.close();
  }catch(e){if(document.getElementById('tmpMasquePreview'))document.body.removeChild(tmp);showToast('Erreur : '+e.message,true);}
}

function publierProjetMasque(idx){
  const p=state.projetsMasque[idx];
  if(!p)return;
  // Stocker l'index pour la confirmation
  window._projetMasqueAPublierIdx=idx;
  const today=new Date();
  document.getElementById('masqueDateApplication').value=today.toISOString().slice(0,10);
  updateModePublicationStyle();
  openModal('modalPublierMasque');
}

function modifierProjetMasque(idx){
  const p=state.projetsMasque[idx];
  if(!p)return;
  const backup=JSON.parse(JSON.stringify(p)); // sauvegarde
  _projetMasque={masque:JSON.parse(JSON.stringify(p.masque)),masqueStart:p.masqueStart,nom:p.nom,_backupIdx:idx,_backup:backup};
  state.projetsMasque.splice(idx,1);
  saveState();
  renderProjetsMasqueListe();
  document.getElementById('projetMasqueCard').style.display='none';
  document.getElementById('masqueActuelCard').style.display='none';
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetMasqueEditor').style.display='block';
  document.getElementById('projetMasqueEditorInfo').textContent=p.nom;
  document.getElementById('btnValiderProjetMasque').textContent='✅ Enregistrer les modifications';
  document.getElementById('btnAnnulerProjetMasque').textContent='✕ Annuler les modifications';
  renderProjetMasquePreview();
}

function supprimerProjetMasque(idx){
  if(!confirm('Supprimer ce projet de masque ?'))return;
  state.projetsMasque.splice(idx,1);
  saveState();
  renderProjetsMasqueListe();
}

function updateModePublicationStyle(){
  const val=document.querySelector('input[name="modePublicationMasque"]:checked')?.value||'remplace';
  ['Remplace','Preserve','Fusion'].forEach(n=>{
    const el=document.getElementById('mode'+n+'Label');
    if(el){el.style.borderColor='var(--bordure)';el.style.background='';}
  });
  const colors={remplace:'#c0392b',preserve:'#e67e22',fusion:'#2980b9'};
  const active=document.getElementById('mode'+val.charAt(0).toUpperCase()+val.slice(1)+'Label');
  if(active){active.style.borderColor=colors[val];active.style.background='#f9f9f9';}
}

async function confirmerPublierMasque(){
  const dateApp=document.getElementById('masqueDateApplication').value;
  const mode=document.querySelector('input[name="modePublicationMasque"]:checked')?.value||'remplace';
  const envoyerEmail=document.getElementById('pubMasqueEmail')?.checked||false;
  closeModal('modalPublierMasque');
  // Venir de publierProjetMasque (idx stocké) ou de _projetMasque (ancienne voie)
  const idx=window._projetMasqueAPublierIdx;
  if(idx!==undefined&&idx!==null&&state.projetsMasque[idx]){
    const p=state.projetsMasque[idx];
    _projetMasque={masque:p.masque,masqueStart:p.masqueStart};
    await _appliquerNouveauMasque(dateApp, mode, envoyerEmail);
    state.projetsMasque.splice(idx,1);
    window._projetMasqueAPublierIdx=null;
    renderProjetsMasqueListe();
  } else if(_projetMasque){
    await _appliquerNouveauMasque(dateApp, mode, envoyerEmail);
  }
}

function getMasqueCellFromData(masque,ms,ds,h,init){
  if(!masque||!ms)return false;
  const si=getMasqueSemaineIndex(ds,ms);
  const ji=getMasqueJourIndex(ds);
  if(ji>5)return false;
  const row=masque[si]?.cells[ji]?.[h];
  if(!row)return false;
  if(typeof row==='object'&&!Array.isArray(row))return !!(row[init]);
  return false;
}

async function _appliquerNouveauMasque(dateApplication, mode, envoyerEmail=false){
  if(!_projetMasque)return;
  // Sauvegarde automatique best-effort
  const backupUrl=state.params.saveUrl?.replace('save.php','')||'/';
  fetch(backupUrl+'cron_backup.php?token=pharmacie-lempdes-cron-2026&action=backup&type=manual').catch(()=>{});

  // Sauvegarder l'ancien masque
  const ancienMasque=state.masque?JSON.parse(JSON.stringify(state.masque)):null;
  const ancienStart=state.masqueStart;
  if(ancienMasque){
    if(!state.historiquesMasques)state.historiquesMasques=[];
    state.historiquesMasques.unshift({id:Date.now(),date:new Date().toISOString(),masque:ancienMasque,masqueStart:ancienStart});
    if(state.historiquesMasques.length>10)state.historiquesMasques=state.historiquesMasques.slice(0,10);
  }

  // Appliquer le nouveau masque
  state.masque=_projetMasque.masque;
  state.masqueStart=_projetMasque.masqueStart;

  if(mode==='remplace'){
    // Supprimer tous les overrides à partir de dateApplication
    Object.keys(state.calendar).forEach(ds=>{if(ds>=dateApplication)delete state.calendar[ds];});
  } else if(mode==='preserve'){
    // Garder uniquement les semaines avec modifications
    let cur=strToDate(dateApplication);
    while(cur.getDay()!==1)cur=new Date(cur.getTime()-86400000);
    for(let w=0;w<104;w++){
      let hasModif=false;
      for(let j=0;j<6;j++){if(state.calendar[addDays(dateToStr(cur),j)]){hasModif=true;break;}}
      if(!hasModif) for(let j=0;j<6;j++) delete state.calendar[addDays(dateToStr(cur),j)];
      cur=new Date(cur.getTime()+7*86400000);
    }
  } else if(mode==='fusion'){
    // Supprimer les overrides qui correspondent à l'ancien masque (pas de modif manuelle)
    const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
    const emps=state.employes.filter(e=>e.actif!==false);
    Object.keys(state.calendar).forEach(ds=>{
      if(ds<dateApplication)return;
      const calDay=state.calendar[ds];
      if(!calDay)return;
      let allMatch=true;
      for(let h=0;h<nbH&&allMatch;h++){
        const row=calDay[h];
        if(!row){allMatch=false;break;}
        emps.forEach(e=>{
          const calVal=Array.isArray(row)?row[state.employes.indexOf(e)]:row[e.init];
          if(calVal!==undefined&&calVal!==getMasqueCellFromData(ancienMasque,ancienStart,ds,h,e.init))allMatch=false;
        });
      }
      if(allMatch)delete state.calendar[ds];
    });
  }

  _projetMasque=null;
  saveState();
  document.getElementById('projetMasqueEditor').style.display='none';
  document.getElementById('projetMasqueCard').style.display='block';
  document.getElementById('masqueActuelCard').style.display='block';
  renderMasqueActuel();
  renderPlanning();
  renderHistorique();
  showToast('✅ Nouveau masque appliqué !');
  if(envoyerEmail){
    try{
      const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
      const r=await fetch(saveUrl+'send_planning_projet.php',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:'pharmacie-lempdes-cron-2026',projetIdx:-1,projetNom:'Nouveau masque',state})
      });
      const d=await r.json();
      if(d.ok) showToast(`✅ Masque envoyé à ${d.nb} employé(s)`);
      else showToast('❌ Erreur envoi email',true);
    }catch(e){showToast('❌ Erreur envoi email',true);}
  }
}

// ═══════════════════════════════════════════════════════════
// PROJETS
// ═══════════════════════════════════════════════════════════
let _currentProjetIdx = null;
let _projetBlockStart = null;

function updateNpBaseStyle(){
  const val=document.querySelector('input[name="npBase"]:checked')?.value||'masque';
  ['Masque','Planning','Zero'].forEach(n=>{
    const el=document.getElementById('npBase'+n+'Label');
    if(el){el.style.borderColor='var(--bordure)';el.style.background='';}
  });
  const active=document.getElementById('npBase'+val.charAt(0).toUpperCase()+val.slice(1)+'Label');
  if(active){active.style.borderColor='var(--vert)';active.style.background='var(--vert-clair)';}
  document.getElementById('npBaseDesc').textContent=val==='masque'
    ?'Repart de la quinzaine type — idéal pour créer un planning exceptionnel.'
    :'Repart du planning actif — idéal pour ajuster ce qui est déjà prévu.';
}

function openNewProjet(base) {
  base=base||'masque';
  const d = new Date(), day = d.getDay(), diff = (1+7-day)%7||7;
  d.setDate(d.getDate()+diff);
  document.getElementById('npDebut').value = d.toISOString().split('T')[0];
  const fin = new Date(d); fin.setDate(fin.getDate()+27);
  document.getElementById('npFin').value = fin.toISOString().split('T')[0];
  document.getElementById('npNom').value = '';
  document.getElementById('npBase').value=base;
  const labels={'zero':'⬜ Départ sur planning vierge','masque':'📋 Basé sur le masque de référence','planning':'📅 Basé sur le planning actif'};
  document.getElementById('npBaseInfo').textContent=labels[base]||'';
  openModal('modalNewProjet');
}

function confirmerNouveauProjet() {
  const nom = document.getElementById('npNom').value.trim();
  const debut = document.getElementById('npDebut').value;
  const fin = document.getElementById('npFin').value;
  if (!nom) { showToast('Nom requis', true); return; }
  if (!debut || !fin) { showToast('Dates requises', true); return; }

  const base = document.getElementById('npBase')?.value || 'masque';
  const projet = {
    id: Date.now(),
    nom, debut, fin,
    statut: 'brouillon',
    base, // 'masque' ou 'planning'
    calendar: {},
    createdAt: new Date().toISOString()
  };

  if (!state.projets) state.projets = [];
  state.projets.push(projet);
  saveState();
  closeModal('modalNewProjet');
  renderProjetsList();
  showToast('Projet créé — cliquez ✏ Éditer pour le modifier');
}


// ═══════════════════════════════════════════════════════════
// HISTORIQUE & RESTAURATION
// ═══════════════════════════════════════════════════════════
function renderHistorique(){
  const el=document.getElementById('historiqueList');
  // ── Section masques précédents ──
  const histMasques=state.historiquesMasques||[];
  let htmlMasques='';
  if(histMasques.length>0){
    htmlMasques='<div style="font-weight:700;font-size:.82rem;color:var(--gris);margin-bottom:.5rem">🗓 Masques précédents</div>';
    htmlMasques+=histMasques.map((h,i)=>{
      const d=new Date(h.date).toLocaleString('fr-FR');
      const ms=strToDate(h.masqueStart).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="hist-card">
        <div><div style="font-weight:700;font-size:.84rem">🗓 Masque du ${ms}</div>
        <div style="font-size:.72rem;color:var(--gris)">Remplacé le ${d}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-danger btn-sm" onclick="restaurerMasque(${i})">↩ Annuler</button>
          <button class="btn btn-danger btn-sm" onclick="supprimerMasqueHisto(${i})">🗑</button>
        </div>
      </div>`;
    }).join('');
    htmlMasques+='<hr style="margin:.8rem 0;border-color:var(--bordure)">';
  }
  // ── Section plannings ──
  const hist=state.historique||[];
  if(hist.length===0){
    el.innerHTML=htmlMasques+'<div class="empty" style="padding:1rem"><p>Aucune publication de planning enregistrée.</p></div>';
    return;
  }
  el.innerHTML=htmlMasques+hist.map((h,i)=>{
    const d=new Date(h.date).toLocaleString('fr-FR');
    const nbDates=h.snapshot?Object.keys(h.snapshot).length:0;
    const debut=h.dates?.debut?strToDate(h.dates.debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'?';
    const fin=h.dates?.fin?strToDate(h.dates.fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'?';
    return `<div class="hist-card">
      <div>
        <div style="font-weight:700;font-size:.86rem">📦 ${h.projetNom||'Projet'}</div>
        <div style="font-size:.74rem;color:var(--gris);margin-top:2px">
          Publié le ${d} · ${nbDates} jour(s) · Du ${debut} au ${fin}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="previewSnapshot(${i})">👁 Aperçu</button>
        <button class="btn btn-danger btn-sm" onclick="restaurerSnapshot(${i})">↩ Annuler</button>
        <button class="btn btn-danger btn-sm" onclick="supprimerSnapshot(${i})">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function restaurerSnapshot(idx){
  const h=state.historique[idx];
  if(!confirm(`Restaurer le planning à l'état avant la publication de "${h.projetNom}" ?\nLes modifications actuelles sur ces dates seront écrasées.`))return;

  // Restaurer les dates du snapshot
  Object.keys(h.snapshot).forEach(ds=>{
    if(h.snapshot[ds]===null){
      delete state.calendar[ds]; // pas de modif avant = retour masque
    } else {
      state.calendar[ds]=h.snapshot[ds];
    }
  });

  // Remettre le projet en brouillon si encore présent
  const projetIdx=state.projets.findIndex(p=>p.id===h.projetId);
  if(projetIdx>=0){
    state.projets[projetIdx].statut='brouillon';
    delete state.projets[projetIdx].publieLe;
  }

  // Supprimer cet historique et tous les plus récents (cohérence)
  state.historique=state.historique.slice(idx+1);

  saveState();
  renderPlanning();
  renderHistorique();
  renderProjetsList();
  showToast('✅ Planning restauré');
}

function previewSnapshot(idx){
  const h=state.historique[idx];
  const nbDates=Object.keys(h.snapshot).length;
  const dates=Object.keys(h.snapshot).sort();
  const debut=dates[0]?strToDate(dates[0]).toLocaleDateString('fr-FR'):'-';
  const fin=dates[dates.length-1]?strToDate(dates[dates.length-1]).toLocaleDateString('fr-FR'):'-';
  alert(`Snapshot avant publication de "${h.projetNom}"\n\nPublié le : ${new Date(h.date).toLocaleString('fr-FR')}\nDates concernées : ${debut} → ${fin}\nNombre de jours : ${nbDates}\n\nCliquez "Restaurer" pour revenir à cet état.`);
}

function depublierProjet(idx){
  const p=state.projets[idx];
  // Trouver le snapshot correspondant
  const histIdx=state.historique.findIndex(h=>h.projetId===p.id);
  if(histIdx===-1){
    showToast('Aucun snapshot trouvé pour ce projet',true);return;
  }
  if(!confirm(`Dépublier "${p.nom}" et restaurer le planning précédent ?`))return;
  restaurerSnapshot(histIdx);
}

function supprimerMasqueHisto(idx){
  if(!confirm('Supprimer ce masque de l\'historique ?'))return;
  state.historiquesMasques.splice(idx,1);
  saveState();renderHistorique();
  showToast('Masque supprimé de l\'historique');
}

function restaurerMasque(idx){
  const h=state.historiquesMasques[idx];
  if(!h){showToast('Snapshot introuvable',true);return;}
  if(!confirm("Restaurer ce masque ? Le masque actuel sera sauvegardé."))return;
  // Sauvegarder le masque actuel
  if(state.masque){
    state.historiquesMasques.splice(idx,0,{
      id:Date.now(),date:new Date().toISOString(),
      masque:JSON.parse(JSON.stringify(state.masque)),masqueStart:state.masqueStart
    });
    idx++; // décaler
  }
  state.masque=JSON.parse(JSON.stringify(h.masque));
  state.masqueStart=h.masqueStart;
  state.calendar={};
  state.historiquesMasques.splice(idx,1); // supprimer le snapshot restauré
  if(state.historiquesMasques.length>10)state.historiquesMasques=state.historiquesMasques.slice(0,10);
  saveState();renderMasqueActuel();renderPlanning();renderHistorique();
  showToast('✅ Masque restauré !');
}

function supprimerSnapshot(idx){
  if(!confirm('Supprimer ce point de restauration ?'))return;
  state.historique.splice(idx,1);
  saveState();renderHistorique();
  showToast('Entrée supprimée');
}

function clearHistorique(){
  if(!confirm("Vider tout l'historique ? Les points de restauration seront perdus."))return;
  state.historique=[];
  saveState();
  renderHistorique();
  showToast('Historique vidé');
}

function renderProjetsList() {
  const el = document.getElementById('projetsList');
  if (!state.projets || state.projets.length === 0) {
    el.innerHTML = '<div class="empty" style="padding:1rem"><p>Aucun projet.</p></div>';
    return;
  }
  el.innerHTML = state.projets.map((p, i) => `
    <div class="projet-card ${p.statut}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-weight:700;font-size:.88rem">${p.nom}</div>
          <div style="font-size:.75rem;color:var(--gris);margin-top:2px">
            ${strToDate(p.debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
            → ${strToDate(p.fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="statut-badge ${p.statut}">${p.statut==='publie'?'✅ Publié':'📝 Brouillon'}</span>
          <button class="btn btn-secondary btn-sm" onclick="openProjetEditor(${i})">✏ Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="ouvrirEtImprimer(${i})">🖨 Imprimer</button>
          <button class="btn btn-secondary btn-sm" onclick="ouvrirEtEnvoyer(${i})">✉ Envoyer</button>
          ${p.statut==='brouillon'?`<button class="btn btn-primary btn-sm" onclick="publierProjetDirect(${i})">✅ Publier</button>`:(`<button class="btn btn-secondary btn-sm" onclick="depublierProjet(${i})">↺ Dépublier</button>`)}
          <button class="btn btn-danger btn-sm" onclick="supprimerProjet(${i})">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function openProjetEditor(idx) {
  _currentProjetIdx = idx;
  const p = state.projets[idx];
  document.getElementById('projetEditorTitle').textContent = p.nom;
  document.getElementById('projetEditorDates').textContent =
    strToDate(p.debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) +
    ' → ' + strToDate(p.fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  document.getElementById('projetsListView').style.display='none';
  document.getElementById('projetsEditorView').style.display='block';

  // Caler le bloc sur le début du projet en respectant l'alignement masque
  if(state.masqueStart){
    const ms=strToDate(state.masqueStart);
    const d=strToDate(p.debut);
    const diffDays=Math.round((d-ms)/MS_DAY);
    const blockOffset=Math.floor(diffDays/28)*28;
    _projetBlockStart=addDays(state.masqueStart, blockOffset);
  } else {
    _projetBlockStart=p.debut;
  }
  renderProjetPlanning();
}

function closeProjetEditor() {
  _currentProjetIdx = null;
  document.getElementById('projetsEditorView').style.display='none';
  document.getElementById('projetsListView').style.display='block';
  renderProjetsList();
}

// navProjet supprimé — période fixée à la création

function renderProjetPlanning() {
  if (_currentProjetIdx === null) return;
  const p = state.projets[_currentProjetIdx];
  if(!p){return;}
  const open = state.params.open||9, close = state.params.close||19, nbH = close-open;
  const emps = state.employes, ne = emps.length;
  const SEM_BG = ['#1a4a34','#1a3a5c','#1a4a34','#1a3a5c','#1a4a34','#1a3a5c','#1a4a34','#1a3a5c'];
  const CS = 20, HS = 19, FS = '.68rem', FSS = '.6rem';

  // Vérifier que le masque est chargé
  if(!state.masque||!state.masqueStart){
    document.getElementById('projetScaleWrap').innerHTML='<div class="empty"><div class="big">⚠</div><p>Chargez un masque avant de créer un projet.</p></div>';
    return;
  }

  // Caler blockStart sur le lundi de la semaine contenant p.debut
  const debutDate = strToDate(p.debut);
  const finDate   = strToDate(p.fin);
  // Trouver le lundi de la semaine du début
  const dow = debutDate.getDay();
  const diffToMon = (dow === 0) ? -6 : 1 - dow;
  const blockStart = new Date(debutDate);
  blockStart.setDate(blockStart.getDate() + diffToMon);
  blockStart.setHours(0,0,0,0);
  _projetBlockStart = dateToStr(blockStart);

  // Calculer le nombre de semaines nécessaires pour couvrir toute la période
  const diffDays = Math.round((finDate - blockStart) / MS_DAY);
  const nbSem = Math.min(Math.ceil((diffDays + 1) / 7), 8); // max 8 semaines

  // Label
  document.getElementById('projetBlockLabel').textContent =
    blockStart.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) +
    ' → ' + finDate.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});

  // Compter les diffs vs masque dans ce projet
  let nDiff = 0;
  for (let s=0;s<nbSem;s++) for (let j=0;j<6;j++) {
    const ds = addDays(_projetBlockStart, s*7+j);
    if (p.calendar[ds]) {
      for (let h=0;h<nbH;h++) for (let ei=0;ei<emps.length;ei++) {
        const cv=p.calendar[ds][h]?.[ei];
        if (cv!==undefined && cv!==getMasqueCell(ds,h,ei)) nDiff++;
      }
    }
  }
  const db = document.getElementById('diffBadgeProjet');
  const nJours=new Set(Array.from({length:nbSem},(_,s)=>Array.from({length:6},(_,j)=>addDays(_projetBlockStart,s*7+j)).filter(ds=>p.calendar[ds]&&(()=>{const open=state.params.open||9,close=state.params.close||19,nbH=close-open;for(let h=0;h<nbH;h++)for(let ei=0;ei<emps.length;ei++){const cv=p.calendar[ds][h]?.[ei];if(cv!==undefined&&cv!==getMasqueCell(ds,h,ei))return true;}return false;})())).flat()).size;
  if(nJours>0){db.style.display='inline-block';db.textContent=`⚠ ${nJours} jour${nJours>1?'s':''} modifié${nJours>1?'s':''}`;}
  else db.style.display='none';

  let html = `<table class="pl" style="font-size:${FS}">`;
  for (let s=0;s<nbSem;s++) {
    const sbg = SEM_BG[s];
    const totalCols = 6*ne+5*2;
    

    const jourDates = [];
    for (let j=0;j<6;j++) {
      const d = strToDate(addDays(_projetBlockStart, s*7+j));
      jourDates.push({str:dateToStr(d),label:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})});
    }

    html+=`<tr class="r-sem" style="background-image:url('data:image/jpeg;base64,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');background-size:cover;background-position:center"><td class="corner r0" style="background:transparent"></td>`;
    html+=`<td class="sem-label" colspan="${Math.floor(totalCols*.55)}" style="background:transparent;font-size:${FS};color:#f5e06a;font-weight:700;text-shadow:1px 1px 4px #000,0 0 8px #000">S${s+1}</td>`;
    html+=`<td class="sem-date" colspan="${totalCols-Math.floor(totalCols*.55)}" style="background:transparent;font-size:${FSS};color:#f5e06a;text-shadow:1px 1px 3px #000">${jourDates[0].label} → ${jourDates[5].label}</td></tr>`;

    // Jours
    html+=`<tr class="r-jour"><td class="corner r1" style="background:${sbg}"></td>`;
    for(let j=0;j<6;j++){
      const ds=jourDates[j].str;
      const hasModif=(()=>{for(let h=0;h<nbH;h++)for(let ei=0;ei<emps.length;ei++){const _r=p.calendar[ds]?.[h];if(!_r)continue;const _v=Array.isArray(_r)?_r[ei]:_r[emps[ei].init];if(_v!==undefined&&_v!==getMasqueCell(ds,h,emps[ei].init))return true;}return false;})()
      const icon=hasModif?' ⚠':'';
      html+=`<td class="jour-label" colspan="${ne}" style="background:${sbg};border-color:${sbg};font-size:0.82rem;overflow:hidden;white-space:nowrap">${JOURS[j]}${icon}<br><span style="font-size:0.68rem;opacity:.85;font-weight:500">${jourDates[j].label}</span></td>`;
      if(j<5)html+=`<td class="sep1" style="width:2px;background:${sbg}"></td><td class="sep2" style="width:2px;background:${sbg}"></td>`;
    }
    html+=`</tr>`;

    // Hn = heures contrat
    html+=`<tr class="r-hnorm"><td class="corner r2" style="font-size:${FSS}"><span style="color:#17375e">Hn</span></td>`;
    for(let j=0;j<6;j++){
      if(j===0){
        const sIdx=getSemaineIndex(jourDates[0].str);
        emps.forEach(e=>{
          const hn=getHeuresContrat(e,sIdx);
          html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px">${hn}</td>`;
        });
      } else emps.forEach(()=>html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px;background:#f0f4f2;border-color:#dde8e3"></td>`);
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // He
    html+=`<tr class="r-heff"><td class="corner r3" style="font-size:${FSS}"><span style="color:#375623">He</span></td>`;
    for(let j=0;j<6;j++){
      if(j===0){emps.forEach((e,ei)=>{
        // Sommer toutes les heures de la semaine
        let heff=0;
        for(let jj=0;jj<6;jj++)heff+=countHJourProjet(p,jourDates[jj]?.str||addDays(jourDates[0].str,jj),e.init);
        const cc=getHeuresContrat(e,getSemaineIndex(jourDates[0].str));
        const cls=cc===0?'h-neu':heff===cc?'h-ok':'h-warn';
        html+=`<td class="h-val ${cls}" style="font-size:${FSS};width:${CS}px;min-width:${CS}px">${heff}</td>`;
      });}
      else emps.forEach(()=>html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px;background:#f0f4f2;border-color:#dde8e3"></td>`);
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // Initiales
    html+=`<tr class="r-init"><td class="corner r4" style="background:#2a7a56"></td>`;
    for(let j=0;j<6;j++){
      emps.forEach(e=>html+=`<td class="init-cell" style="background:${e.color};color:${tc(e.color)};font-size:${FSS};width:${CS}px;min-width:${CS}px">${e.init}</td>`);
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // Heures
    for(let h=0;h<nbH;h++){
      html+=`<tr><td class="heure-c" style="font-size:${FSS}">${open+h}h</td>`;
      for(let j=0;j<6;j++){
        const ds=jourDates[j].str;
        emps.forEach((e,ei)=>{
          const on=getCellProjet(p,ds,h,e.init);
          const bg=on?`background:${e.color};`:'';
          const cls=on?'on':'off';
          html+=`<td class="cell ${cls}" style="${bg}width:${CS}px;min-width:${CS}px;height:${HS}px" onclick="toggleCellProjet('${ds}',${h},'${e.init}')" title="${e.nom} · ${JOURS[j]} ${open+h}h"></td>`;
        });
        if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
      }
      html+=`</tr>`;
    }

    // Moyenne quinzaine
    if(s===1||s===3){
      const lundi1=s===1?_projetBlockStart:addDays(_projetBlockStart,14);
      html+=`<tr class="r-moy"><td class="h-label" style="font-size:${FSS}">MQ${s===1?1:2}</td>`;
      for(let j=0;j<6;j++){
        emps.forEach((e,ei)=>{
          const moy=moyH2semProjet(p,lundi1,ei),cc=getHeuresContrat(e,getSemaineIndex(lundi1));
          const cls=cc===0?'h-neu':moy===cc?'h-ok':'h-warn';
          html+=`<td class="${cls}" style="background:${e.color}22;border-color:${e.color}88;font-size:${FSS};width:${CS}px;min-width:${CS}px">${moy}</td>`;
        });
        if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
      }
      html+=`</tr>`;
    }
  }
  html+='</table>';
  document.getElementById('projetScaleWrap').innerHTML=html;
  setTimeout(()=>applyProjetScale(),50);
}

function getCellProjet(p,ds,h,init){
  // Override explicite du projet en priorité
  if(p.calendar[ds]&&p.calendar[ds][h]){
    const row=p.calendar[ds][h];
    const val=Array.isArray(row)?row[state.employes.findIndex(e=>e.init===init)]:row[init];
    if(val!==undefined)return val;
  }
  if(p.base==='planning') return getCell(ds,h,init);
  if(p.base==='zero') return false;
  return getMasqueCell(ds,h,init);
}

function countHJourProjet(p,ds,init){
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  let t=0;for(let h=0;h<nbH;h++)if(getCellProjet(p,ds,h,init))t++;return t;
}

function moyH2semProjet(p,lundi1Str,init){
  let t=0;
  for(let j=0;j<6;j++){const d=addDays(lundi1Str,j);t+=countHJourProjet(p,d,init);}
  const h1=t;t=0;
  for(let j=0;j<6;j++){const d=addDays(lundi1Str,7+j);t+=countHJourProjet(p,d,init);}
  return(h1+t)/2;
}

function toggleCellProjet(ds,h,init){
  if(_currentProjetIdx===null)return;
  const p=state.projets[_currentProjetIdx];
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const emps=state.employes.filter(e=>e.actif!==false);
  if(!p.calendar[ds]){
    p.calendar[ds]=[];
    for(let hh=0;hh<nbH;hh++){
      const row={};
      emps.forEach(e=>{
        row[e.init]=p.base==='zero'?false:getMasqueCell(ds,hh,e.init);
      });
      p.calendar[ds].push(row);
    }
  }
  if(!p.calendar[ds][h])p.calendar[ds][h]={};
  const row=p.calendar[ds][h];
  const cur=Array.isArray(row)?row[state.employes.findIndex(e=>e.init===init)]:!!(row[init]);
  if(Array.isArray(row)){const ei=state.employes.findIndex(e=>e.init===init);row[ei]=!cur;}
  else row[init]=!cur;
  saveState();renderProjetPlanning();
}

function resetProjetPeriode(){
  if(_currentProjetIdx===null)return;
  if(!confirm('Réinitialiser les 4 semaines affichées avec le masque ?'))return;
  const p=state.projets[_currentProjetIdx];
  for(let s=0;s<4;s++)for(let j=0;j<6;j++){const ds=addDays(_projetBlockStart,s*7+j);delete p.calendar[ds];}
  saveState();renderProjetPlanning();showToast('Réinitialisé');
}


// ═══════════════════════════════════════════════════════════
// PROJET — APERÇU ET ENVOI
// ═══════════════════════════════════════════════════════════

function ouvrirEtImprimer(idx){
  openProjetEditor(idx);
  setTimeout(()=>imprimerProjet(),600);
}
function ouvrirEtEnvoyer(idx){
  openProjetEditor(idx);
  setTimeout(()=>envoyerProjet(),200);
}


async function imprimerMasqueActuel(){
  if(!state.masque){showToast('Aucun masque à imprimer',true);return;}
  showToast('Génération en cours...');

  // Générer un tableau 4 semaines (S1 S2 S1 S2) dans un div temporaire
  const tmp=document.createElement('div');
  tmp.style.cssText='position:absolute;left:-9999px;top:0;background:#fff';
  document.body.appendChild(tmp);
  tmp.id='tmpMasque4sem';

  // Dupliquer le masque S1+S2+S1+S2
  const masque4=[
    state.masque[0],state.masque[1],
    state.masque[0],state.masque[1]
  ];
  renderMasqueTable(masque4,'tmpMasque4sem');
  await new Promise(r=>setTimeout(r,300));

  try{
    const canvas=await html2canvas(tmp,{
      scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,
      width:tmp.scrollWidth,height:tmp.scrollHeight+10,
    });
    document.body.removeChild(tmp);
    const imgData=canvas.toDataURL('image/png');
    const printWin=window.open('','_blank');
    printWin.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Masque — Pharmacie du Marais</title>
<style>
  @page{size:A4 landscape;margin:0.3cm}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif}
  .header{font-size:11px;color:#666;margin-bottom:6px;text-align:center;font-weight:600}
  img{max-width:100%;max-height:95vh;object-fit:contain}
</style>
</head><body>
<div class="header">⚕ Pharmacie du Marais — Masque de référence (S1 · S2 · S1 · S2)</div>
<img src="${imgData}">
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`);
    printWin.document.close();
  }catch(e){
    if(document.getElementById('tmpMasque4sem'))document.body.removeChild(tmp);
    showToast('Erreur : '+e.message,true);
  }
}

async function imprimerProjet(){
  if(_currentProjetIdx===null)return;
  const p=state.projets[_currentProjetIdx];
  const scaleWrap=document.getElementById('projetScaleWrap');
  if(!scaleWrap){showToast('Aucun aperçu disponible',true);return;}

  showToast('Génération en cours...');
  const prevTransform=scaleWrap.style.transform;
  scaleWrap.style.transform='none';
  await new Promise(r=>setTimeout(r,300));

  try{
    const canvas=await html2canvas(scaleWrap,{
      scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,
      width:scaleWrap.scrollWidth,height:scaleWrap.scrollHeight+20,
    });
    const imgData=canvas.toDataURL('image/png');
    const printWin=window.open('','_blank');
    printWin.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${p.nom} — Aperçu</title>
<style>
  @page{size:A4 landscape;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:297mm;height:210mm;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;background:#fff}
  .header{font-size:11px;color:#666;margin-bottom:4px;align-self:flex-start;padding-left:4px}
  .badge{background:#e67e22;color:#fff;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:6px}
  img{max-width:297mm;max-height:195mm;object-fit:contain}
</style>
</head><body>
<div class="header">⚕ Pharmacie du Marais — ${p.nom}<span class="badge">PRÉVISIONNEL</span></div>
<img src="${imgData}">
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`);
    printWin.document.close();
  }catch(e){
    showToast('Erreur : '+e.message,true);
  }finally{
    scaleWrap.style.transform=prevTransform;
  }
}

async function envoyerProjet(){
  if(_currentProjetIdx===null)return;
  const p=state.projets[_currentProjetIdx];
  if(!confirm('Envoyer le planning prévisionnel "'+p.nom+'" à tous les employés ?'))return;

  const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
  showToast('Envoi en cours...');

  try{
    const r=await fetch(saveUrl+'send_planning_projet.php',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        token:'pharmacie-lempdes-cron-2026',
        projetIdx:_currentProjetIdx,
        projetNom:p.nom,
        state:state
      })
    });
    const d=await r.json();
    if(d.ok) showToast('✅ Envoyé à '+d.nb+' employé(s)');
    else showToast('❌ '+(d.error||'Erreur'),true);
  }catch(e){
    showToast('❌ '+e.message,true);
  }
}

function publierProjet(){
  publierProjetDirect(_currentProjetIdx);
}

function publierProjetDirect(idx){
  const p=state.projets[idx];
  if(!p)return;
  window._projetAPublierIdx=idx;
  document.getElementById('pubPeriodeEmail').checked=false;
  openModal('modalPublierPeriode');
}

async function confirmerPublierPeriode(){
  const idx=window._projetAPublierIdx;
  const p=state.projets[idx];
  if(!p)return;
  const envoyerEmail=document.getElementById('pubPeriodeEmail').checked;
  closeModal('modalPublierPeriode');
  await _appliquerPublicationPeriode(idx, envoyerEmail);
}

async function _appliquerPublicationPeriode(idx, envoyerEmail){
  const p=state.projets[idx];
  if(!p)return;

  // ── Générer TOUTES les dates de la période (pas seulement celles modifiées) ──
  const datesAffectees=[];
  let cur=p.debut;
  while(cur<=p.fin){
    const d=strToDate(cur);
    const dow=d.getDay(); // 0=dim, 6=sam
    if(dow!==0) datesAffectees.push(cur); // exclure dimanches
    cur=addDays(cur,1);
  }

  // ── Snapshot avant publication (état actuel de state.calendar pour ces dates) ──
  const snapshot={};
  datesAffectees.forEach(ds=>{
    snapshot[ds]=state.calendar[ds]?JSON.parse(JSON.stringify(state.calendar[ds])):null;
  });
  if(!state.historique)state.historique=[];
  state.historique.unshift({
    id:Date.now(),
    projetNom:p.nom,
    projetId:p.id,
    date:new Date().toISOString(),
    dates:{debut:p.debut,fin:p.fin},
    snapshot
  });
  if(state.historique.length>20)state.historique=state.historique.slice(0,20);

  // ── Fusionner dans state.calendar : pour chaque date, reconstruire depuis getCellProjet ──
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const empsActifs=state.employes.filter(e=>e.actif!==false);
  datesAffectees.forEach(ds=>{
    const jourCells=[];
    for(let h=0;h<nbH;h++){
      const row={};
      empsActifs.forEach(e=>{
        row[e.init]=getCellProjet(p,ds,h,e.init);
      });
      jourCells.push(row);
    }
    state.calendar[ds]=jourCells;
  });

  p.statut='publie';
  p.publieLe=new Date().toISOString();
  // Sauvegarde backup avant publication
  const backupUrl=state.params.saveUrl?.replace('save.php','')||'/';
  fetch(backupUrl+'cron_backup.php?token=pharmacie-lempdes-cron-2026&action=backup&type=manual').catch(()=>{});
  // Sauvegarde immédiate
  clearTimeout(_saveTimer);
  _doSave();
  if(_currentProjetIdx!==null)closeProjetEditor();
  renderProjetsList();
  renderPlanning();
  showToast(`✅ Projet "${p.nom}" publié !`);
  // Envoi email si demandé
  if(envoyerEmail){
    try{
      const saveUrl=state.params.saveUrl?.replace('save.php','')||'/';
      const r=await fetch(saveUrl+'send_planning_projet.php',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:'pharmacie-lempdes-cron-2026',projetIdx:idx,projetNom:p.nom,state})
      });
      const d=await r.json();
      if(d.ok) showToast(`✅ Planning envoyé à ${d.nb} employé(s)`);
      else showToast('❌ Erreur envoi email',true);
    }catch(e){showToast('❌ Erreur envoi email',true);}
  }
}

function supprimerProjet(idx){
  if(!confirm(`Supprimer le projet "${state.projets[idx].nom}" ?`))return;
  state.projets.splice(idx,1);
  saveState();renderProjetsList();showToast('Supprimé');
}

async function init(){
  registerSW();
  await loadState();
  initMnemosyne();
  fillHoraireSelects();
  applyParams();
  renderEmpList();
  renderLog();
  updateMasqueStatus();
  // Gestion hash URL depuis notification push
  if(window.location.hash==='#mnemosyne'){
    showTab('mnemosyne');
    showMneView('daily');
    history.replaceState(null,'',window.location.pathname);
  }
  migrateCalendarFormat();
  goToday();
  window.addEventListener('resize',()=>{if(isViewer||isAdmin)applyAutoScale();});
  // Demander le code de visualisation au démarrage
  demandCodeVisu();
}

function fillHoraireSelects(){
  ['pOpen','pClose'].forEach(id=>{
    const s=document.getElementById(id);
    for(let h=6;h<=23;h++)s.innerHTML+=`<option value="${h}">${h}h00</option>`;
  });
}
// ── Sauvegarde : serveur si URL configurée, sinon localStorage ──
function saveState(){
  // Debounce 800ms pour éviter trop de requêtes
  clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>_doSave(),800);
}
async function _doSave(){
  const json=JSON.stringify(state);
  const url=state.params.saveUrl;
  if(url){
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:json});
      const d=await r.json();
      if(!d.ok)throw new Error(d.error||'?');
      // Backup localStorage aussi
      try{localStorage.setItem('pharmaPlanning7',json);}catch{}
    }catch(e){
      console.warn('Sauvegarde serveur échouée:',e.message);
      // Fallback localStorage
      try{localStorage.setItem('pharmaPlanning7',json);}catch(le){pruneCalendar();localStorage.setItem('pharmaPlanning7',JSON.stringify(state));}
    }
  }else{
    try{localStorage.setItem('pharmaPlanning7',json);}catch(e){pruneCalendar();localStorage.setItem('pharmaPlanning7',JSON.stringify(state));}
  }
}

async function loadState(){
  // Essayer d'abord le localStorage
  try{
    const s=JSON.parse(localStorage.getItem('pharmaPlanning7'));
    if(s){
      Object.assign(state,s);
      if(!state.projets)state.projets=[];
      if(!state.historique)state.historique=[];
    }
  }catch{}
  // URL save.php : depuis l'état chargé OU par déduction depuis l'URL courante
  let url=state.params.saveUrl;
  if(!url){
    // Déduire automatiquement : même domaine, même dossier, fichier save.php
    // Construire l'URL save.php depuis l'URL courante
    const parts=window.location.href.split('/');
    parts[parts.length-1]='save.php';
    url=parts.join('/');
  }
  if(url){
    try{
      const r=await fetch(url,{method:'GET'});
      const d=await r.json();
      if(d){
        Object.assign(state,d);
        // Garantir que les tableaux existent (compatibilité anciennes versions)
        if(!state.projets)state.projets=[];
        if(!state.historique)state.historique=[];
        // S'assurer que saveUrl est bien enregistré
        if(!state.params.saveUrl)state.params.saveUrl=url;
        try{localStorage.setItem('pharmaPlanning7',JSON.stringify(state));}catch{}
      }
    }catch(e){console.warn('Chargement serveur échoué:',e.message);}
  }
}

// Purge les overrides de plus de 6 mois
function pruneCalendar(){
  const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-6);
  Object.keys(state.calendar).forEach(k=>{
    if(new Date(k)<cutoff)delete state.calendar[k];
  });
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION CALENDRIER
// ═══════════════════════════════════════════════════════════
function dateToStr(d){
  // Toujours en heure locale pour éviter les décalages UTC
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),j=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${j}`;
}
function strToDate(s){
  // Construire en heure locale, pas UTC
  const [y,m,j]=s.split('-').map(Number);
  return new Date(y,m-1,j,0,0,0,0);
}

function addDays(dateStr,n){
  const d=strToDate(dateStr);
  d.setDate(d.getDate()+n);
  return dateToStr(d);
}

function getLundi(date){
  const d=new Date(date); d.setHours(0,0,0,0);
  const day=d.getDay();
  const diff=(day===0)?-6:(1-day);
  d.setDate(d.getDate()+diff);
  return d;
}


async function imprimerPlanning(){
  const scaleWrap=document.getElementById('scaleWrap');
  if(!scaleWrap){window.print();return;}

  showToast('Generation en cours...');

  const prevTransform=scaleWrap.style.transform;
  const prevOrigin=scaleWrap.style.transformOrigin;
  scaleWrap.style.transform='none';
  scaleWrap.style.transformOrigin='top left';

  await new Promise(r=>setTimeout(r,300));

  try{
    const canvas=await html2canvas(scaleWrap,{
      scale:2,
      useCORS:true,
      backgroundColor:'#ffffff',
      logging:false,
      width:scaleWrap.scrollWidth,
      height:scaleWrap.scrollHeight+20,
    });

    const imgData=canvas.toDataURL('image/png');
    const printWin=window.open('','_blank');
    printWin.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Planning Pharmacie du Marais</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  img { max-width: 297mm; max-height: 210mm; object-fit: contain; display: block; }
</style>
</head><body>
<img src="${imgData}">
<script>
  window.onload=function(){
    setTimeout(function(){ window.print(); }, 500);
  };
<\/script>
</body></html>`);
    printWin.document.close();

  }catch(e){
    alert('Erreur impression : '+e.message);
  }finally{
    scaleWrap.style.transform=prevTransform;
    scaleWrap.style.transformOrigin=prevOrigin;
  }
}

function goToday(){
  const today=new Date(); today.setHours(0,0,0,0);
  if(state.masqueStart){
    const ms=strToDate(state.masqueStart);
    // Nombre de jours entiers entre masqueStart et aujourd'hui
    const msTime=ms.getTime(), todayTime=today.getTime();
    const diffDays=Math.round((todayTime-msTime)/MS_DAY);
    // Bloc de 28 jours contenant aujourd'hui
    const blockIdx=Math.floor(diffDays/28);
    state.currentBlockStart=addDays(state.masqueStart, blockIdx*28);
  } else {
    state.currentBlockStart=dateToStr(getLundi(today));
  }
  saveState();
  renderPlanning();
}

function navPeriode(dir){
  if(!state.currentBlockStart){goToday();return;}
  // Ajouter ou soustraire exactement 28 jours en arithmétique de date locale
  state.currentBlockStart=addDays(state.currentBlockStart, dir*28);
  saveState();
  renderPlanning();
}

// ── Heures contrat selon semaine de rotation ──
function getHeuresContrat_contrat(emp,semaineIndex){
  // Retourne les heures contractuelles (pas masque)
  const rot=emp.rotation||2;
  const hc=emp.heuresContrat||(emp.heuresParSemaine||[emp.heures||35]);
  if(hc.length<2)return hc[0]||emp.heures||35;
  const idx=((semaineIndex%rot)+rot)%rot;
  return hc[idx]||emp.heures||35;
}

function getHeuresContrat(emp,semaineIndex){
  const rot=emp.rotation||2;
  const hps=emp.heuresParSemaine||[emp.heures||35];
  if(hps.length<2)return hps[0]||emp.heures||35;
  // Modulo positif pour gérer les index négatifs
  const idx=((semaineIndex%rot)+rot)%rot;
  return hps[idx]||emp.heures||35;
}

function getSemaineIndex(lundoStr){
  if(!state.masqueStart)return 0;
  const ms=strToDate(state.masqueStart);
  const d=strToDate(lundoStr);
  const diffDays=Math.round((d-ms)/MS_DAY);
  return Math.floor(diffDays/7);
}

// ═══════════════════════════════════════════════════════════
// DONNÉES CALENDRIER
// getMasqueCell : retourne la valeur du masque pour un jour donné
// getCell / setCell : lit/écrit dans le calendrier (override ou masque)
// ═══════════════════════════════════════════════════════════
function getMasqueSemaineIndex(dateStr){
  if(!state.masqueStart)return 0;
  const ms=strToDate(state.masqueStart);
  const d=strToDate(dateStr);
  const diffDays=Math.round((d-ms)/MS_DAY);
  if(diffDays<0){const mod=((diffDays%14)+14)%14;return mod<7?0:1;}
  return Math.floor(diffDays/7)%2;
}

function getMasqueJourIndex(dateStr){
  const d=strToDate(dateStr);
  const day=d.getDay();
  return day===0?6:day-1;
}

// ── Masque par initiales ──
function getMasqueCell(dateStr,h,init){
  if(!state.masque)return false;
  const si=getMasqueSemaineIndex(dateStr);
  const ji=getMasqueJourIndex(dateStr);
  const cells=state.masque[si]?.cells[ji]?.[h];
  if(!cells)return false;
  // Nouveau format : objet {init: bool}
  if(typeof cells==='object'&&!Array.isArray(cells)) return cells[init]||false;
  // Ancien format (index) — migration automatique
  const ei=state.employes.findIndex(e=>e.init===init);
  return ei>=0?(cells[ei]||false):false;
}

function getCell(dateStr,h,init){
  const ov=state.calendar[dateStr];
  if(ov&&ov[h]!==undefined){
    const row=ov[h];
    if(typeof row==='object'&&!Array.isArray(row)){
      // Si override existe et row non vide → absent si clé manquante
      if(Object.keys(row).length>0) return row.hasOwnProperty(init)?!!row[init]:false;
      return getMasqueCell(dateStr,h,init);
    }
    // Ancien format par index
    const _ei=state.employes.findIndex(e=>e.init===init);
    return _ei>=0?(!!row[_ei]):false;
  }
  return getMasqueCell(dateStr,h,init);
}

function setCell(dateStr,h,init,val){
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  if(!state.calendar[dateStr]){
    state.calendar[dateStr]=[];
    for(let hh=0;hh<nbH;hh++){
      const row={};
      state.employes.filter(e=>e.actif!==false).forEach(e=>{row[e.init]=getMasqueCell(dateStr,hh,e.init);});
      state.calendar[dateStr].push(row);
    }
  }
  if(!state.calendar[dateStr][h])state.calendar[dateStr][h]={};
  state.calendar[dateStr][h][init]=val;
}

// ── Migration ancien format → nouveau format par initiales ──
function migrateCalendarFormat(){
  const emps=state.employes;
  let migrated=false;

  // Migrer le masque
  if(state.masque){
    for(let si=0;si<2;si++){
      for(let ji=0;ji<6;ji++){
        const cells=state.masque[si]?.cells[ji];
        if(!cells)continue;
        for(let h=0;h<cells.length;h++){
          if(Array.isArray(cells[h])){
            const newRow={};
            cells[h].forEach((v,ei)=>{if(emps[ei])newRow[emps[ei].init]=v;});
            cells[h]=newRow;
            migrated=true;
          }
        }
      }
    }
  }

  // Migrer le calendar
  Object.keys(state.calendar).forEach(ds=>{
    const day=state.calendar[ds];
    if(!day)return;
    for(let h=0;h<day.length;h++){
      if(Array.isArray(day[h])){
        const newRow={};
        day[h].forEach((v,ei)=>{if(emps[ei])newRow[emps[ei].init]=v;});
        day[h]=newRow;
        migrated=true;
      }
    }
  });

  if(migrated){saveState();console.log('Migration format initiales OK');}
}

function countHJour(dateStr,init){
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  let t=0;
  for(let h=0;h<nbH;h++)if(getCell(dateStr,h,init))t++;
  return t;
}

function countHSemaine(lundoStr,init){
  let t=0;
  for(let j=0;j<6;j++){
    const d=strToDate(addDays(lundoStr,j));
    t+=countHJour(dateToStr(d),init);
  }
  return t;
}

function moyH2sem(lundi1Str,init){
  const h1=countHSemaine(lundi1Str,init);
  const d2=strToDate(addDays(lundi1Str,7));
  const h2=countHSemaine(dateToStr(d2),init);
  return(h1+h2)/2;
}

// ═══════════════════════════════════════════════════════════
// RESET PERIODE (réinitialiser au masque)
// ═══════════════════════════════════════════════════════════
function resetCurrentPeriode(){
  if(!confirm('Réinitialiser les 4 semaines affichées avec le masque ? Les modifications seront perdues.'))return;
  if(!state.currentBlockStart)return;
  for(let s=0;s<4;s++){
    for(let j=0;j<6;j++){
      const d=strToDate(addDays(state.currentBlockStart,s*7+j));
      const ds=dateToStr(d);
      delete state.calendar[ds];
    }
  }
  saveState();renderPlanning();showToast('Période réinitialisée avec le masque');
}

// ═══════════════════════════════════════════════════════════
// RENDER PLANNING
// ═══════════════════════════════════════════════════════════
function renderPlanning(){
  const scaleWrap=document.getElementById('scaleWrap');
  if(!state.currentBlockStart){
    scaleWrap.innerHTML='<div class="empty"><div class="big">📋</div><p>Chargez un masque pour commencer.</p></div>';
    updateCalLabel();return;
  }
  const today=new Date(); today.setHours(0,0,0,0);
  const todayStr=dateToStr(today);
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const emps=state.employes.filter(e=>e.actif!==false),ne=emps.length;
  const blockStart=strToDate(state.currentBlockStart);
  const SEM_BG=['#1a0533','#2d0a5e','#1a0533','#2d0a5e'];
  const admin=isAdmin;
  const CS=admin?20:16,HS=admin?19:15;
  const FS=admin?'.68rem':'.6rem',FSS=admin?'.6rem':'.52rem';

  // Calculer les diffs (S3 vs S1, S4 vs S2)
  const diffs=computeDiffCells(blockStart);

  let html=`<table class="pl" style="font-size:${FS}">`;

  for(let s=0;s<4;s++){
    const lundiSemStr=addDays(dateToStr(blockStart),s*7);
    const lundiSem=strToDate(lundiSemStr);
    const lundiStr=dateToStr(lundiSem);
    const sbg=SEM_BG[s];
    const nd=diffs.filter(d=>d.s===s).length;
    const warn=nd>0?` ⚠${nd}`:'';
    const totalCols=6*ne+5*2;

    if(s>0){
      const wCols=ne*6+5*2+1;
      html+=`<tr class="sem-sep" style="height:0;padding:0"><td colspan="${wCols+1}" style="padding:0;height:0;line-height:0"><div style="width:100%;overflow:hidden;line-height:0"><img src="data:image/jpeg;base64,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DrNIbiMwLbyGRlhYSSyR+WViWWWhRRQAUUUUAFFFFAF/SNX0/TdP1WyvfC1hqEmoWC29pd3klwsmmSC4hlNxAIpURpCkTwETLLH5dxIQgkEUsdCr+kavp+m6fqtle+FrDUJNQsFt7S7vJLhZNMkFxDKbiARSojSFIngImWWPy7iQhBIIpY6FJAFFFFMAooooAKKv+HLfwxdahJF4u1e/sbQWF08U2m6al1I10tvI1tEUeaILHJOIo5JAxaKN3kWOZkET0KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAv2/hbxPd+GLzxtaeHL+XRtPv7axv8AV47N2tba6uEnkt4JJQNiSSpa3LIhIZ1t5SoIjbFCiigAooooAKKKKACir9vb+GG8MXl3d6vfprKX9slhYR6ajWs1qyTm4lkuDMHikR1tlSMROsiyys0kRiVZqFABV/wt4j1Dwd4n03xdpNvYTXelX8N5bRarpVvfWryROHVZra5SSG4jJUBopUeN1yrqykg0KKNwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKveF/Dt/4v8S6d4T0q4sYrrVL6G0tpdU1SCxtkkkcIrTXNy6Q28YLAtLK6RouWZlUEijV/wALeHNQ8Y+J9N8I6TcWEN3qt/DZ20uq6rb2NqkkrhFaa5uXjht4wWBaWV0jRcs7KoJClfldgKFFFFMAoq/pGr6fpun6rZXvhaw1CTULBbe0u7yS4WTTJBcQym4gEUqI0hSJ4CJllj8u4kIQSCKWOhQAUUUUAFFFFABRRRQAUUVf0jV9P03T9Vsr3wtYahJqFgtvaXd5JcLJpkguIZTcQCKVEaQpE8BEyyx+XcSEIJBFLGAUKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooq/4W8Oah4x8T6b4R0m4sIbvVb+GztpdV1W3sbVJJXCK01zcvHDbxgsC0srpGi5Z2VQSDYChRRRQAUUU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MHikR1tlSMROsiyys0kRiVZqFJbsAooopgFFFFAF/V7fwxBp+lS6Bq9/c3c1gz63DeaakEdpdfaJlWKB1mkNxGYFt5DIywsJJZI/LKxLLLQq/b6Rp8/hi81+XxTYQ3dtf21vDokkdwbq7jlSdnuI2WIwiOIxRo4eVJC11F5aSKJWioUkAUUVf8LeHNQ8Y+J9N8I6TcWEN3qt/DZ20uq6rb2NqkkrhFaa5uXjht4wWBaWV0jRcs7KoJD2AoUUUUAX9I1fT9N0/VbK98LWGoSahYLb2l3eSXCyaZILiGU3EAilRGkKRPARMssfl3EhCCQRSx0KKKACiiigAooooAKKv+HPFPifwdqEmreEfEd/pV3NYXVjLc6bePBI9rdW8ltcwFkIJjlgllhkQ/K8crowKsQaFABV/wALeHNQ8Y+J9N8I6TcWEN3qt/DZ20uq6rb2NqkkrhFaa5uXjht4wWBaWV0jRcs7KoJFCigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAv2/hbxPd+GLzxtaeHL+XRtPv7axv9Xjs3a1trq4SeS3gklA2JJKlrcsiEhnW3lKgiNsUKv6R4c1DXNP1XU7K4sEj0ewW8u1vNVt7eSSNriG3CwRyur3Um+dCYoQ8gjWSUqI4pXShSQBRRRTAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAq94Y8PX/AIu8S6f4U0q4sYrrU76G0tpdT1OCytkkkcIrTXFw6Q28YLAtLK6RouWZlUEijRSlzOL5d/69ACiiimAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFX/C3hzUPGPifTfCOk3FhDd6rfw2dtLquq29japJK4RWmubl44beMFgWlldI0XLOyqCRQooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKALulaBfaxY6lqNpPZJHpVkt1dLdalBBI8ZnigAhSR1a4k3zITFEHcIJJCojikdaVFFTFTTfM9Ommyst9XfW+umllbS7AoooqgCiiigAoq/4ct/DF1qEkXi7V7+xtBYXTxTabpqXUjXS28jW0RR5ogsck4ijkkDFoo3eRY5mQRPQoAKKKKACiiigDe8P3/gjT/BHiBdX037br179ktNFjuLKUw2UJlM1xepPHdx7LlfJht1ilguIZIb26cmGWGBmwaKKSVgCiiimAUUUUAFFX9Xt/DEGn6VLoGr39zdzWDPrcN5pqQR2l19omVYoHWaQ3EZgW3kMjLCwklkj8srEsstCgAooooAKKKKACiiigAooooAKKKKACir/hzxT4n8HahJq3hHxHf6VdzWF1Yy3Om3jwSPa3VvJbXMBZCCY5YJZYZEPyvHK6MCrEGhQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRV/w54p8T+DtQk1bwj4jv9Ku5rC6sZbnTbx4JHtbq3ktrmAshBMcsEssMiH5XjldGBViDQoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKveGPD1/4u8S6f4U0q4sYrrU76G0tpdT1OCytkkkcIrTXFw6Q28YLAtLK6RouWZlUEijRSlzOL5d/69ACiiimAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBd0rQL7WLHUtRtJ7JI9KslurpbrUoIJHjM8UAEKSOrXEm+ZCYog7hBJIVEcUjrSq/pHhzUNc0/VdTsriwSPR7Bby7W81W3t5JI2uIbcLBHK6vdSb50JihDyCNZJSojildKFRHnu7tb6abKy31d3e7vpo0raXYFFFFWAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAX9Xt/DEGn6VLoGr39zdzWDPrcN5pqQR2l19omVYoHWaQ3EZgW3kMjLCwklkj8srEsstCiigAooooAKKKKACiiigAooooAKKKKACiiigAq/4W8Oah4x8T6b4R0m4sIbvVb+GztpdV1W3sbVJJXCK01zcvHDbxgsC0srpGi5Z2VQSKFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFXfDegX3ivxFYeF9LnsornUr2K1t5dS1KCytkkkcIpluLh0hgjBI3SyOqIMszKoJFKipmpuDUHZ9Lq6v5q6v6XXqgCiiiqAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAv6R4c1DXNP1XU7K4sEj0ewW8u1vNVt7eSSNriG3CwRyur3Um+dCYoQ8gjWSUqI4pXShRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRXpf7Qn7Hn7TP7LGtXei/Hb4Qanoq2V5BaTatE0d7pj3E0Hnxwx39q8lrM5jDErHKxUxyKQGjcL5pXNhMZg8ww8a+FqRqQlqpRalFrumrpjacXZhRRRXSIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACivWNY/YM/bl8PSSRa/wDsY/FixaKRklW8+HWpxFGU4ZSGgGCDwR2ru7L/AIJGft+3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VPn553vvpe1rWW1tbXv8Wt7/AGbAFFFFagFFFFABRV/V7fwxBp+lS6Bq9/c3c1gz63DeaakEdpdfaJlWKB1mkNxGYFt5DIywsJJZI/LKxLLLQoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoq7B4b8RXXh268X22gXsmk2N7b2d7qkdq5tre5nSZ4IXkA2pJIlvcMiEgsIJSAQjYpVMZwm2ou7Wj8nZOz7aNP0aAKKKKoAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiit34Xtr6fEzw6/hQaF/ag120Om/8JQLA6Z9o85PL+1jUf8AQ/s+7Hmfav8AR9m7zfk3VMpKEXJuyQGFRRRVAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABV+38U+J7TwxeeCbTxHfxaNqF/bX1/pEd462tzdW6Tx288kQOx5IkurlUcgsi3EoUgSNmhRRuAV3fw5/aj/aa+DvhSTwH8I/2ivHfhbQ5tQe/m0bw54uvbG0ku2jSNrgwwyqhlMcaIXI3FUUZwAK4SiubF4LB4+j7HFU41IaO0kpK61WjTWj2HGUou8XZntJ/4KPft+w6Hp/hXRv2zfiZo2j6Todho+m6H4d8Z3mmWFtZWdrFa28SW1pJHCCIoY9z7d0j7pJC8ju7ZH/Dcf7a2Sf8AhsH4pZPU/wDCwNS57f8APavLaK858N8OyvfB0tf+ncOuvbuaRr1oqyk182emn9tb9sokk/ta/E3nr/xXuo//AB6nr+29+2iq7F/a8+KAA6AeP9R/+PV5fRT/ANXOHv8AoDpf+C4f5FLE4lO6m/vZ6heftu/toaj4b1DwdqH7XfxQn0jV9PmsNV0qbx/qLW17ayqUlgliM22SJ1ZlZGBVgxBBBrzzxJ4k8ReMvEV/4v8AF+v3uq6tqt7LeapqmpXTz3N5cyuXkmlkclpJHdmZnYksSSSSapUV2YXLcuwM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UPGPifTfCOk3FhDd6rfw2dtLquq29japJK4RWmubl44beMFgWlldI0XLOyqCRQq/4W8Oah4x8T6b4R0m4sIbvVb+GztpdV1W3sbVJJXCK01zcvHDbxgsC0srpGi5Z2VQSE9EBQooopgX9I1fT9N0/VbK98LWGoSahYLb2l3eSXCyaZILiGU3EAilRGkKRPARMssfl3EhCCQRSx0KKKACiiigAooooAKKKKACiiigAooooAKKKKACr/inV9P8QeJ9S1/SfC1hoVpfX81xbaJpUlw9rp8buWW3ha5llmaOMEIpllkkKqN7u2WNCigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACrvhvQL7xX4isPC+lz2UVzqV7Fa28upalBZWySSOEUy3Fw6QwRgkbpZHVEGWZlUEilV3w3oF94r8RWHhfS57KK51K9itbeXUtSgsrZJJHCKZbi4dIYIwSN0sjqiDLMyqCRlWn7OjKXMo2Td3stN3qtF11WnVDW5SooorURf0jw5qGuafqup2VxYJHo9gt5drearb28kkbXENuFgjldXupN86ExQh5BGskpURxSulCiigAooooAKKKKACiiigAooq/pHhzUNc0/VdTsriwSPR7Bby7W81W3t5JI2uIbcLBHK6vdSb50JihDyCNZJSojildDYChRRRQBb06PfZ37fY7SXZaKd9zc+W8P76Mbol3r5j87SuHwjO20bd6VK0NGsJbzTtWuI7XT5Baaessj3moLDJGDcQpugRpEM8mXCmNVkIjaWTYBGZEz6uduWPp+r8l+vr0WtS3JC3b9X5L85evRFFFb3w+8P+CNe1d2+IfxB/4R/SrT7PLeSW2ky319dQtdwQzR2UAKRS3KQyy3AS4ntYXW2dPPWRo1fNuyMjBooopgb3gW/wDBFt/bOneOtN3w3+g3EWnalDZS3Nxp18m2e3khjW7t4/3skK2krzecsVvdzypBLNHCBg1f8OW/hi61CSLxdq9/Y2gsLp4ptN01LqRrpbeRraIo80QWOScRRySBi0UbvIsczIInoUuoBV+38LeJ7vwxeeNrTw5fy6Np9/bWN/q8dm7WttdXCTyW8EkoGxJJUtblkQkM628pUERtihRTAKKKKAN7w/f+CNP8EeIF1fTftuvXv2S00WO4spTDZQmUzXF6k8d3HsuV8mG3WKWC4hkhvbpyYZYYGbBre8P3/gjT/BHiBdX037br179ktNFjuLKUw2UJlM1xepPHdx7LlfJht1ilguIZIb26cmGWGBmwaS3YBRRRTAKKKKAL+r2/hiDT9Kl0DV7+5u5rBn1uG801II7S6+0TKsUDrNIbiMwLbyGRlhYSSyR+WViWWWhW94g0/wCGNt4I8P3/AIW8X69eeJLn7X/wlWk6h4chtrHTtsoFt9ku0vJZL3zI8tJ5lvbeUwCr5wO8YNJagFFFFMAooooA3vAt/wCCLb+2dO8dabvhv9BuItO1KGylubjTr5Ns9vJDGt3bx/vZIVtJXm85Yre7nlSCWaOEDBoopW1AKv8AiPxHqHinUI9T1O3sIpIrC1s1XTdKt7OMx29vHbxsY7dERpCkSmSUgyTSF5ZGeSR3ahRTAKKKKACir/hy38MXWoSReLtXv7G0FhdPFNpumpdSNdLbyNbRFHmiCxyTiKOSQMWijd5FjmZBE9CgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAL9v4W8T3fhi88bWnhy/l0bT7+2sb/AFeOzdrW2urhJ5LeCSUDYkkqWtyyISGdbeUqCI2xQre8P/DPxv4n8EeIPiTpGibtB8L/AGRda1W4uYoIYprqUx29shkZfOuZNk0i28W+ZobW6mCeVbTyR4NJO7YBRRRTAKKKKACiiigAooooAKKKKAL9v4W8T3fhi88bWnhy/l0bT7+2sb/V47N2tba6uEnkt4JJQNiSSpa3LIhIZ1t5SoIjbFCiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooq7r+v33iS+j1HUYLKOSOytrVVsNNgtIzHBAkCEpAiK0hSNS8pBeVy8kjPI7u0tz50ktNeut9LaW9bu6tZaO+gUqKKKoAooooAKKKKACiiigAooooAKveF/Dt/4v8S6d4T0q4sYrrVL6G0tpdU1SCxtkkkcIrTXNy6Q28YLAtLK6RouWZlUEijVvQdFvPEmuWXh7T5rSO4v7uO2gkv7+G1gV3YKpknnZIoUBI3SSMqKMlmABNKV+V2AqUUUUwCiiigAooooAKKKKACiiigAq/wCI7fwxa6hHF4R1e/vrQ2Fq8s2paalrIt01vG1zEESaUNHHOZY45CwaWNEkaOFnMSUKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKlsksZJmXUbmaKPyZCrQwiRjIEJRSCy4UvtBbOVBLAMRtLScnZFRi5yUV1+X4vREVFFFIkKKKKACiiigAooooAKKKKACrvhvQL7xX4isPC+lz2UVzqV7Fa28upalBZWySSOEUy3Fw6QwRgkbpZHVEGWZlUEilV3w3oF94r8RWHhfS57KK51K9itbeXUtSgsrZJJHCKZbi4dIYIwSN0sjqiDLMyqCRlWn7OjKXMo2Td3stN3qtF11WnVDW5SooorUQUUUUAFFFFABRRRQAUUUUAFFFX9I1fT9N0/VbK98LWGoSahYLb2l3eSXCyaZILiGU3EAilRGkKRPARMssfl3EhCCQRSxgFCiiigDQ0awlvNO1a4jtdPkFpp6yyPeagsMkYNxCm6BGkQzyZcKY1WQiNpZNgEZkTPrQ0Z4l07Vlk0bT7otp6iOe8umjksz9ohPmwKsqCWQgGMoyygRyytsBQSR59XK/LG66fq/v/H9DWopKMLrp231fkr+uva+lkUUUVBkFFFFAG94U0/4Y3mkahN448X69p1/Hu/sq20nw5Dew3H+iXbjzZJLyBoc3SWMR2pJiG4uJuWt47e5wa3vCmn/DG80jUJvHHi/XtOv4939lW2k+HIb2G4/0S7cebJJeQNDm6SxiO1JMQ3FxNy1vHb3ODSW7DqFFFFMAooooA63wvounxfCHxZ40vfBV/qUiX+l6PaanJo1w1hpMlybi6MxvIrqNIb10094YbeaGeOeCW/kHlSWsT1yVb3h/TdXg8EeIPFLfDP8AtXSv9E0mTxFcW935Oh308puYCkkMiRC5mhsbyNY5xIrw/amWPzIlliwalbsQUUUVQwooooA3vEGn/DG28EeH7/wt4v1688SXP2v/AISrSdQ8OQ21jp22UC2+yXaXksl75keWk8y3tvKYBV84HeMGr+r2/hiDT9Kl0DV7+5u5rBn1uG801II7S6+0TKsUDrNIbiMwLbyGRlhYSSyR+WViWWWhSQBRRRTAKKKKALularY6fY6laXfhuyvpL6yWC1urqScSadIJ4pDPCI5EVpCkbwkSrImyeQhBII5I6VXdK1Wx0+x1K0u/DdlfSX1ksFrdXUk4k06QTxSGeERyIrSFI3hIlWRNk8hCCQRyR0qypq056Na9XdPRarV2XS2mqbtrdgUUUVqAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAdbb/CrUPEPw4vPib4JS/u9M8OWFsfGt9qdtb2Vrp9/c3k8NrZWsrXDG/klgjW4WNVScrFfMIDBYy3J5KusuvD3xc+MFj4x+Pmv3V9rSWF9HeeMPFWu6qrS3N/f3DbA81w4e7vZ38+bykMk7x291PtMdvPJHydRCSk2r3t+Gidn9/wB1hK4UUUVYwooooAv2/inxPaeGLzwTaeI7+LRtQv7a+v8ASI7x1tbm6t0njt55IgdjyRJdXKo5BZFuJQpAkbNCr9vb+GG8MXl3d6vfprKX9slhYR6ajWs1qyTm4lkuDMHikR1tlSMROsiyys0kRiVZqFJWAKKKKYBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFWtC0a78Ra3Z+H9PmtY5766jt4JL+/itYFd2CgyTTMkcKAkZkkZUUZLEAE1Vrb8CWZ17V28E2uhaJc33iIwabpl/r2riwh0ud7qFhci4kuIbeHhGieS6LQJFPK7BGVJY8603TpuX+Wnm7taLd63stLvQDEooorQAooooAKKKKACiiigC7qsHh2Gx02TRNVvbi5lsmbWIbqwSGO1ufPlVY4XWVzPGYRA5kZYiHkkj2FY1lkpUUVMIuKs3ffe3V7aJbbLrZatvUAooq/pGr6fpun6rZXvhaw1CTULBbe0u7yS4WTTJBcQym4gEUqI0hSJ4CJllj8u4kIQSCKWOgKFFFFAF/xT4j1Dxj4n1Lxdq1vYQ3eq3815cxaVpVvY2qSSuXZYba2SOG3jBYhYokSNFwqKqgAUKKKNgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACr/AIWt/DF34n0208bavf6fo0t/Cmr3+laal5dW1qXAllht5JoUnkVNzLG0sSuwCmRAdwoVf8LW/hi78T6baeNtXv8AT9Glv4U1e/0rTUvLq2tS4EssNvJNCk8ipuZY2liV2AUyIDuCewFCiiimAUUUUAFX9I8Oahrmn6rqdlcWCR6PYLeXa3mq29vJJG1xDbhYI5XV7qTfOhMUIeQRrJKVEcUroeKdX0/xB4n1LX9J8LWGhWl9fzXFtomlSXD2unxu5ZbeFrmWWZo4wQimWWSQqo3u7ZY0KWtgCiiimB1vgjwV4n1X4ceNfHlp8O7DUtG0ewsrW/8AEGp3r266PdXN5Ebf7KRPElxezJBcotsVnY2y306wgWrXFvyVb3hCz+0+H/FM3/CPaDe/Z9Bjk+06vrP2W4sM6hZp59jH9oi+13J3eU0Oy4xbzXM3lL5P2iDBqVuxIKKKKoYUUUUAdb8EH8MWnxHttd8VeOLDw/Ho1hf6tp15qvhVNbtbnUrOzmurCwmspVeKaO7vIbe0bzkeFFuS8qPGjqeSq/4ct/DF1qEkXi7V7+xtBYXTxTabpqXUjXS28jW0RR5ogsck4ijkkDFoo3eRY5mQRPQpW94OoUUUUwCiiigDrfC+i6fF8IfFnjS98FX+pSJf6Xo9pqcmjXDWGkyXJuLozG8iuo0hvXTT3hht5oZ454Jb+QeVJaxPXJVft/C3ie78MXnja08OX8ujaff21jf6vHZu1rbXVwk8lvBJKBsSSVLW5ZEJDOtvKVBEbYoUluwCiirugQeHbm+kj8Uare2dsLK5aKawsEuZGuVgdreMo8sQEbzCNHk3Exo7yKkrIInU5qnByey10Tb+SV2/RasClRRRVAX9Xt/DEGn6VLoGr39zdzWDPrcN5pqQR2l19omVYoHWaQ3EZgW3kMjLCwklkj8srEsstCpblLFYbdrS5meRoSbpZIQgjk3sAqEMd67Ah3EKcsy4woZoqbTjoxyi4uz/AM99en9LZ6hRRRSEFFFFAF3StVsdPsdStLvw3ZX0l9ZLBa3V1JOJNOkE8UhnhEciK0hSN4SJVkTZPIQgkEckdKiipjBRba667t9EtO22ysr3e7YBRRRVAFFFFABRUtlf32mzNcadezW8jQyRNJDIUYxyIUdCR/CyMykdCGIPBqKnpbzK93lWuv8AX/B6fffQq/4W8Oah4x8T6b4R0m4sIbvVb+GztpdV1W3sbVJJXCK01zcvHDbxgsC0srpGi5Z2VQSKFFIkKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKv8Aha38MXfifTbTxtq9/p+jS38Kavf6VpqXl1bWpcCWWG3kmhSeRU3MsbSxK7AKZEB3ChRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBveENE0jVfD/AIpv9SsPOm0zQY7nT5P+EmtLDyJjqFnCX8idGk1L93LIv2W3KzLv+0ljDazK2DV+38LeJ7vwxeeNrTw5fy6Np9/bWN/q8dm7WttdXCTyW8EkoGxJJUtblkQkM628pUERtihSW7AKKKKYBRRRQBf8OeKfE/g7UJNW8I+I7/SruawurGW5028eCR7W6t5La5gLIQTHLBLLDIh+V45XRgVYg0KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACtv4arrrfEbQF8L/2J/aZ1u0Gnf8JKbEad5/nL5f2r+0P9E+z7seZ9p/cbN3m/JurEq1oWjXfiLW7Pw/p81rHPfXUdvBJf38VrAruwUGSaZkjhQEjMkjKijJYgAmsq8I1KMoytZprVXW3VaXXddgWjKtFFFagFFFFABRRV/SNX0/TdP1WyvfC1hqEmoWC29pd3klwsmmSC4hlNxAIpURpCkTwETLLH5dxIQgkEUsYBQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKv6vq+n6lp+lWVl4WsNPk0+wa3u7uzkuGk1OQ3E0ouJxLK6LIElSACFYo/Lt4yUMhllkoUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFX/C3hzUPGPifTfCOk3FhDd6rfw2dtLquq29japJK4RWmubl44beMFgWlldI0XLOyqCRQooAKKKKACiiigAq/4Wt/DF34n0208bavf6fo0t/Cmr3+laal5dW1qXAllht5JoUnkVNzLG0sSuwCmRAdwoUUAFFFFABRRRQAUUUUAFFFFAG94Qs/tPh/xTN/wj2g3v2fQY5PtOr6z9luLDOoWaefYx/aIvtdyd3lNDsuMW81zN5S+T9ogwa3vCFn9p8P+KZv+Ee0G9+z6DHJ9p1fWfstxYZ1CzTz7GP7RF9ruTu8podlxi3muZvKXyftEGDSW7AK3vh94f8Ea9q7t8Q/iD/wj+lWn2eW8kttJlvr66ha7ghmjsoAUiluUhlluAlxPawuts6eesjRq+DRQ1dAFFFFMDe+HP/Csf+EguP8Ahbf9vf2V/YOq/ZP+Ec8n7R/af9n3H9m7/O+X7N9v+y/aMfP9n87y/wB5srBrrfgh4j8A+DviPbeLviLb381ppVhf3mlxWOlWN8r6vFZzPpa3NtfpJbXFkdQW0F1FIjh7bz1CsxAPJVP2mLqFFFFUMKKKKANqx8J/bPh3qvjn7LrR/s7WrCw8+DRfM05PtMN5Jtnu/MHkTn7LmGHy285FuX3p9n2yYtdp8OvDH2z4ZfEHxjqPwv8A7YstP0WytLXxDPrf2KLQNRn1K2eKRFJAvp5ra3v4VsxufynuLoLtspGTi64cJiHWxGIhzX5JqP2dP3cJW91t/av76jLXRcnLKTaskFFFFdwgooooA3vEGn/DG28EeH7/AMLeL9evPElz9r/4SrSdQ8OQ21jp22UC2+yXaXksl75keWk8y3tvKYBV84HeMGr/AIW1fT/D/ifTdf1bwtYa7aWN/DcXOiarJcJa6hGjhmt5mtpYpljkAKMYpY5ArHY6NhhQpK4BRRRTAKKKKALularY6fY6laXfhuyvpL6yWC1urqScSadIJ4pDPCI5EVpCkbwkSrImyeQhBII5I6VXdK1Wx0+x1K0u/DdlfSX1ksFrdXUk4k06QTxSGeERyIrSFI3hIlWRNk8hCCQRyR0qypq056Na9XdPRarV2XS2mqbtrdgUUUVqAUUUUAX/AA54p8T+DtQk1bwj4jv9Ku5rC6sZbnTbx4JHtbq3ktrmAshBMcsEssMiH5XjldGBViDQoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDe8P8Awz8b+J/BHiD4k6Rom7QfC/2Rda1W4uYoIYprqUx29shkZfOuZNk0i28W+ZobW6mCeVbTyR4Nd34f8C/E79oHV/EHxg8a+MtlgmvWknjv4jeMdRmkht7vUrsqJ7mULLc3tzI32i5aG3juLuSG1vJ1ikW3mZOEqYu7aEgoooqhhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFX/C3hzUPGPifTfCOk3FhDd6rfw2dtLquq29japJK4RWmubl44beMFgWlldI0XLOyqCRQq/4W8Oah4x8T6b4R0m4sIbvVb+GztpdV1W3sbVJJXCK01zcvHDbxgsC0srpGi5Z2VQSE9EBQooopgFFX9I1fT9N0/VbK98LWGoSahYLb2l3eSXCyaZILiGU3EAilRGkKRPARMssfl3EhCCQRSx0KACiiigAooooAKKKKACiiigAooooAKKv+KfEeoeMfE+peLtWt7CG71W/mvLmLStKt7G1SSVy7LDbWyRw28YLELFEiRouFRVUAChQAVd8SarY674iv9b0vw3ZaNbXl7LPb6Ppsk721jG7llgia4klmMaAhVMkkjkKNzs2WNKipcE5qXVXW7trbps9tHutbbu4FFFFUBf1fV9P1LT9KsrLwtYafJp9g1vd3dnJcNJqchuJpRcTiWV0WQJKkAEKxR+XbxkoZDLLJQoooAKKKKACiiigAooooAKv+KdX0/wAQeJ9S1/SfC1hoVpfX81xbaJpUlw9rp8buWW3ha5llmaOMEIpllkkKqN7u2WNCigAooooAKKKKACrvhuDw7deIrC28X6re2OkyXsS6pe6bYJd3NvbFwJJIoHlhWaRU3FY2ljDEBS6A7hSoqZxc4OKdm+qtdeaumtPNNeQBRRRVAFFFFABRRV/wt4c1Dxj4n03wjpNxYQ3eq38NnbS6rqtvY2qSSuEVprm5eOG3jBYFpZXSNFyzsqgkGwFCiiigAooooAKKKKACiiigAooooAKKKKACiiigDe8IWf2nw/4pm/4R7Qb37PoMcn2nV9Z+y3FhnULNPPsY/tEX2u5O7ymh2XGLea5m8pfJ+0QYNdb4I8Iahqfw48a+NItG8JXlppNhZW80mueLbey1KyknvIilxptk15DNqMmIZIZQkN1HDDcSSSJG3lTR8lUp3bEgq/4W8R6h4O8T6b4u0m3sJrvSr+G8totV0q3vrV5InDqs1tcpJDcRkqA0UqPG65V1ZSQaFFVuMKKKKAOt+Hmi6e/hjxJ4l8YeCr+fw+LD+zB4otdGuLpdF1eVJbvT0UpdW8KSXJsJ7c+eZQts95NHbzS28e3kq3vAt/4Itv7Z07x1pu+G/wBBuItO1KGylubjTr5Ns9vJDGt3bx/vZIVtJXm85Yre7nlSCWaOEDBqVuxdQq/4p1fT/EHifUtf0nwtYaFaX1/NcW2iaVJcPa6fG7llt4WuZZZmjjBCKZZZJCqje7tljQoqhhRRRQB23hS41my+A3jKX+y9cvNJudc0W0lAsro6RZXpW+mgu5Z4rmOJL8QwXkFvFPDOslvd6k6+U8KseJru/D/gL7D+z14g+MWo+Ev7Thu9etPDem3oj82HR7hlN7JcSvBepJaXMkduILZLm2mt7uGTVGiZZtPLJwlc9CjClUqzi/jld+vLGOnyivncL3CiiiugAooooAv3Fv4YXwxZ3dpq9++svf3KX9hJpqLaw2qpAbeWO4ExeWR3a5V4zEixrFEyySmVlhoVveINP+GNt4I8P3/hbxfr154kuftf/CVaTqHhyG2sdO2ygW32S7S8lkvfMjy0nmW9t5TAKvnA7xg0lqAVf8LeHNQ8Y+J9N8I6TcWEN3qt/DZ20uq6rb2NqkkrhFaa5uXjht4wWBaWV0jRcs7KoJFCimAUUUUAX9I1fT9N0/VbK98LWGoSahYLb2l3eSXCyaZILiGU3EAilRGkKRPARMssfl3EhCCQRSx0KKKACr/ha38MXfifTbTxtq9/p+jS38Kavf6VpqXl1bWpcCWWG3kmhSeRU3MsbSxK7AKZEB3ChRQAUUUUAb3w58Q/8Ix4guNS/wCE617w75ug6raf2h4ch33Ev2jT7iD7G48+HFtc+Z9luDvO23uJj5U+PJkwav8AhzxT4n8HahJq3hHxHf6VdzWF1Yy3Om3jwSPa3VvJbXMBZCCY5YJZYZEPyvHK6MCrEGhStrcOoUUVf8LeHNQ8Y+J9N8I6TcWEN3qt/DZ20uq6rb2NqkkrhFaa5uXjht4wWBaWV0jRcs7KoJD2AoUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAX/DninxP4O1CTVvCPiO/0q7msLqxludNvHgke1ureS2uYCyEExywSywyIfleOV0YFWINCiigAooooAKKKKAL9vb+GG8MXl3d6vfprKX9slhYR6ajWs1qyTm4lkuDMHikR1tlSMROsiyys0kRiVZqFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABV/xH4j1DxTqEep6nb2EUkVha2arpulW9nGY7e3jt42MduiI0hSJTJKQZJpC8sjPJI7sUUAUKKKKACiiigAooooAKKKKACiiigArrfgH4c0/xj8dfBfhHVrjwlDaar4t02zuZfH2q3FjoSRy3UaM2o3Ns8c1vZAMTNLE6SJFvZGVgCCipnpBiexyVFFFUMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACr/hbw5qHjHxPpvhHSbiwhu9Vv4bO2l1XVbextUklcIrTXNy8cNvGCwLSyukaLlnZVBIKKmTtFsT0RQoooqhhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHW+CPCGoan8OPGvjSLRvCV5aaTYWVvNJrni23stSspJ7yIpcabZNeQzajJiGSGUJDdRww3EkkiRt5U0fJUUVEJNykuz/RCTu2FFFFWMKKKKACiiigAooooAKKKKAL9vb+GG8MXl3d6vfprKX9slhYR6ajWs1qyTm4lkuDMHikR1tlSMROsiyys0kRiVZqFFFABRRRQAUUUUAX9Xt/DEGn6VLoGr39zdzWDPrcN5pqQR2l19omVYoHWaQ3EZgW3kMjLCwklkj8srEsstCiigAooooAKKKKACiiigAooooAKKKKAN74c+If+EY8QXGpf8J1r3h3zdB1W0/tDw5DvuJftGn3EH2Nx58OLa58z7LcHedtvcTHyp8eTJg0UUra3AKv+FvDmoeMfE+m+EdJuLCG71W/hs7aXVdVt7G1SSVwitNc3Lxw28YLAtLK6RouWdlUEgopSdotieiKFFFFUMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==" style="width:100%;height:55px;object-fit:cover;object-position:center;display:block" alt=""></div></td></tr>`;
    }

    // Dates des 6 jours
    const jourDates=[];
    for(let j=0;j<6;j++){
      const d=strToDate(addDays(dateToStr(lundiSem),j));
      jourDates.push({str:dateToStr(d),label:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})});
    }

    // En-tête semaine
    const dateRange=`${jourDates[0].label} → ${jourDates[5].label}`;
    html+=`<tr class="r-sem"><td class="corner r0" style="background:${sbg}"></td>`;
    html+=`<td class="sem-label" colspan="${Math.floor(totalCols*.55)}" style="background:${sbg};font-size:${FS}">S${s+1}${warn}</td>`;
    html+=`<td class="sem-date" colspan="${totalCols-Math.floor(totalCols*.55)}" style="background:${sbg};font-size:${FSS}">${dateRange}</td></tr>`;

    // Jours
    html+=`<tr class="r-jour"><td class="corner r1" style="background:${sbg}"></td>`;
    for(let j=0;j<6;j++){
      const ds=jourDates[j].str;
      // Détecter si ce jour a des modifications vs masque
      const jourHasModif = (() => {
        const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
        for(let h=0;h<nbH;h++){
          for(let ei=0;ei<emps.length;ei++){
            if(getCell(ds,h,emps[ei].init)!==getMasqueCell(ds,h,emps[ei].init))return true;
          }
        }
        return false;
      })();
      const modifIcon=jourHasModif?' ⚠':'';
      const isToday=jourDates[j].str===todayStr;
      const jourBg=isToday?'#e67e22':sbg;
      html+=`<td class="jour-label" colspan="${ne}" style="background:${jourBg};border-color:${jourBg};font-size:${FS};${isToday?'font-weight:800;':''}">${JOURS[j]}${modifIcon}<br><span style="font-size:${FSS};opacity:.85;font-weight:500">${jourDates[j].label}</span></td>`;
      if(j<5)html+=`<td class="sep1" style="width:2px;background:${sbg}"></td><td class="sep2" style="width:2px;background:${sbg}"></td>`;
    }
    html+=`</tr>`;

    // H normales — valeurs uniquement sous Lundi, vide pour les autres jours
    html+=`<tr class="r-hnorm"><td class="corner r2" style="font-size:${FSS}"><span style="color:#17375e">Hn</span></td>`;
    for(let j=0;j<6;j++){
      if(j===0){
        const sIdx=getSemaineIndex(jourDates[0].str);
        emps.forEach(e=>html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px">${getHeuresContrat(e,sIdx)||'—'}</td>`);
      } else {
        emps.forEach(()=>html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px;background:#f0f4f2;border-color:#dde8e3"></td>`);
      }
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // H effectives — total semaine sous Lundi, vide pour les autres jours
    html+=`<tr class="r-heff"><td class="corner r3" style="font-size:${FSS}"><span style="color:#375623">He</span></td>`;
    for(let j=0;j<6;j++){
      if(j===0){
        emps.forEach((e,ei)=>{
          const heff=countHSemaine(jourDates[0].str,e.init),cc=getHeuresContrat(e,getSemaineIndex(jourDates[0].str));
          const cls=cc===0&&heff===0?'h-neu':heff===cc?'h-ok':'h-warn';
          html+=`<td class="h-val ${cls}" style="font-size:${FSS};width:${CS}px;min-width:${CS}px" title="${e.nom}: ${heff}h/sem">${heff}</td>`;
        });
      } else {
        emps.forEach(()=>html+=`<td class="h-val" style="font-size:${FSS};width:${CS}px;min-width:${CS}px;background:#f0f4f2;border-color:#dde8e3"></td>`);
      }
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // Initiales
    html+=`<tr class="r-init"><td class="corner r4" style="background:#2a7a56"></td>`;
    for(let j=0;j<6;j++){
      emps.forEach(e=>html+=`<td class="init-cell" style="background:${e.color};color:${tc(e.color)};font-size:${FSS};width:${CS}px;min-width:${CS}px" title="${e.nom}">${e.init}</td>`);
      if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
    }
    html+=`</tr>`;

    // Lignes heures
    
    for(let h=0;h<nbH;h++){
      html+=`<tr><td class="heure-c" style="font-size:${FSS}">${open+h}h</td>`;
      for(let j=0;j<6;j++){
        const ds=jourDates[j].str;
        emps.forEach((e,ei)=>{
          const on=getCell(ds,h,e.init);
          const masqueOn=getMasqueCell(ds,h,e.init);
          const isDiff=on!==masqueOn;
          const bg=on?`background:${e.color};`:(isDiff?'background:#fff;':'');
          const outline=isDiff?'box-shadow:inset 0 0 0 2px #000;':'';
          const cls=on?(isDiff?'on diff-on':'on'):(isDiff?'diff-off':'off');
          const click=admin?`onclick="toggleCell('${ds}',${h},'${e.init}')"`:' ';
          html+=`<td class="cell ${cls}" style="${bg}${outline}width:${CS}px;min-width:${CS}px;height:${HS}px" ${click} title="${e.nom} · ${JOURS[j]} ${open+h}h${isDiff?' ⚠':''}"></td>`;
        });
        if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
      }
      html+=`</tr>`;
    }

    // Ligne moyenne quinzaine (après S2 et S4)
    if(s===1||s===3){
      const lundi1=s===1?dateToStr(blockStart):addDays(dateToStr(blockStart),14);
      html+=`<tr class="r-moy"><td class="h-label" style="font-size:${FSS}">MQ${s===1?1:2}</td>`;
      for(let j=0;j<6;j++){
        emps.forEach((e,ei)=>{
          const moy=moyH2sem(lundi1,e.init),cc=getHeuresContrat(e,getSemaineIndex(lundi1));
          const cls=cc===0?'h-neu':moy===cc?'h-ok':'h-warn';
          html+=`<td class="${cls}" style="background:${e.color}22;border-color:${e.color}88;font-size:${FSS};width:${CS}px;min-width:${CS}px">${moy}</td>`;
        });
        if(j<5)html+=`<td class="sep1" style="width:2px"></td><td class="sep2" style="width:2px"></td>`;
      }
      html+=`</tr>`;
    }
  }
  html+='</table>';
  scaleWrap.innerHTML=html;
  updateCalLabel();
  updateNotifBadge(diffs);
  if(!isAdmin)requestAnimationFrame(()=>requestAnimationFrame(applyAutoScale));
}

function toggleCell(ds,h,init){
  if(!isAdmin)return;
  const cur=getCell(ds,h,init);
  setCell(ds,h,init,!cur);
  saveState();renderPlanning();
}

function updateCalLabel(){
  if(!state.currentBlockStart){document.getElementById('calPeriodLabel').textContent='—';return;}
  const d1=strToDate(state.currentBlockStart);
  const d2=strToDate(addDays(dateToStr(d1),27));
  document.getElementById('calPeriodLabel').textContent=
    d1.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})+
    ' → '+
    d2.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
}

// ═══════════════════════════════════════════════════════════
// DIFFS
// ═══════════════════════════════════════════════════════════
// Retourne la liste des cases modifiées par rapport au masque pour le bloc affiché
function computeDiffCells(blockStart){
  if(!state.masque)return[];
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  const diffs=[];
  const joursModifs=new Set();
  const empsActifs=state.employes.filter(e=>e.actif!==false);
  for(let s=0;s<4;s++){
    for(let j=0;j<6;j++){
      const ds=addDays(dateToStr(blockStart),s*7+j);
      if(!state.calendar[ds])continue;
      let jourModif=false;
      for(let h=0;h<nbH;h++){
        empsActifs.forEach((e,ei)=>{
          const row=state.calendar[ds][h];
          if(!row)return;
          // Lire la valeur explicite (format objet ou tableau)
          const calVal=Array.isArray(row)?row[state.employes.indexOf(e)]:row[e.init];
          if(calVal===undefined||calVal===null)return;
          const masqueVal=getMasqueCell(ds,h,e.init);
          if(!!calVal!==!!masqueVal){
            diffs.push({s,j,h,ei,init:e.init,ds});
            jourModif=true;
          }
        });
      }
      if(jourModif)joursModifs.add(ds);
    }
  }
  diffs._joursCount=joursModifs.size;
  return diffs;
}

function updateNotifBadge(diffs){
  if(!diffs)diffs=state.currentBlockStart?computeDiffCells(strToDate(state.currentBlockStart)):[];
  const n=diffs._joursCount||0;
  const b=document.getElementById('notifCount');
  const db=document.getElementById('diffBadge');
  if(n>0){
    if(b){b.style.display='inline-block';b.textContent=n;}
    if(db){db.style.display='inline-block';db.textContent=`⚠ ${n} jour${n>1?'s':''} modifié${n>1?'s':''}`;}
  } else {
    if(b)b.style.display='none';
    if(db)db.style.display='none';
  }
}


let _currentScale=parseFloat(localStorage.getItem('planningZoom')||'0.7');

function manualZoom(factor){
  _currentScale=Math.min(3,Math.max(0.15,_currentScale*factor));
  localStorage.setItem('planningZoom',_currentScale);
  const scaleWrap=document.getElementById('scaleWrap');
  const wrap=document.getElementById('planningWrap');
  const tbl=scaleWrap.querySelector('table.pl');
  if(!tbl)return;
  scaleWrap.style.transform=`scale(${_currentScale})`;
  scaleWrap.style.transformOrigin='top left';
  wrap.style.height=Math.ceil(tbl.offsetHeight*_currentScale)+'px';
}

function resetZoom(){
  _currentScale=1;
  applyAutoScale();
}

function applyProjetScale(){
  const wrap=document.getElementById('projetPlanningWrap');
  const scaleWrap=document.getElementById('projetScaleWrap');
  if(!wrap||!scaleWrap)return;
  // Pas de scale — même largeur que le planning, scroll vertical si besoin
  scaleWrap.style.transform='none';
  scaleWrap.style.transformOrigin='top left';
  wrap.style.height='auto';
  wrap.style.overflowX='auto';
  wrap.style.overflowY='visible';
}

function applyAutoScale(){
  const wrap=document.getElementById('planningWrap');
  const scaleWrap=document.getElementById('scaleWrap');
  const tbl=scaleWrap.querySelector('table.pl');
  if(!tbl){wrap.style.height='200px';return;}
  scaleWrap.style.transform='none';
  wrap.style.height='1px';
  requestAnimationFrame(()=>{
    const naturalW=tbl.offsetWidth,naturalH=tbl.offsetHeight;
    if(!naturalW||!naturalH){wrap.style.height='200px';return;}
    const headerH=document.querySelector('header').offsetHeight||50;
    const navH=document.querySelector('nav')?.offsetHeight||0;
    const calNavH=document.querySelector('.cal-nav')?.offsetHeight||36;
    const cardPad=8;
    const availW=document.getElementById('planningCard').clientWidth-cardPad*2;
    const availH=window.innerHeight-headerH-navH-calNavH-cardPad*2-20;

    // Calculer le scale pour tenir dans la largeur
    // mais appliquer un minimum de 0.5 pour que ce soit lisible
    const scaleW=availW/naturalW;
    const scaleH=availH/naturalH;
    const scaleFit=Math.min(scaleW,scaleH);
    // En visu : on favorise la lisibilité → scale sur largeur seule si > scaleFit
    const scale=Math.max(scaleFit, Math.min(scaleW, 0.9));

    // Utiliser le zoom mémorisé si disponible, sinon calculer
    const saved=parseFloat(localStorage.getItem('planningZoom'));
    const finalScale=saved||scale;
    scaleWrap.style.transform=`scale(${finalScale})`;
    scaleWrap.style.transformOrigin='top left';
    wrap.style.height=Math.ceil(naturalH*finalScale)+'px';
    _currentScale=finalScale;

    // Scroller vers la semaine en cours (S1 = début du bloc = aujourd'hui)
    scrollToCurrentWeek(finalScale);
  });
}

function scrollToCurrentWeek(scale){
  // En mode visu avec scroll horizontal, scroller vers S1
  // Le tableau commence toujours à la semaine en cours (goToday)
  // Pas besoin de scroll horizontal — S1 est toujours à gauche
  // Mais si le tableau dépasse verticalement, pas de scroll nécessaire non plus
  // On s'assure juste que le haut du planning est visible
  const wrap=document.getElementById('planningWrap');
  if(wrap)wrap.scrollTop=0;
}

// ═══════════════════════════════════════════════════════════
// MODE ADMIN / VISU
// ═══════════════════════════════════════════════════════════
function toggleMode(){
  if(isAdmin){openModal('modalLogout');}
  else{
    document.getElementById('pinInput').value='';
    document.getElementById('pinError').textContent='';
    openModal('modalPin');
    setTimeout(()=>document.getElementById('pinInput').focus(),100);
  }
}
function checkPin(){
  const val=document.getElementById('pinInput').value;
  const pwd=state.params.password||DEFAULT_PWD;
  const pwd2=state.params.password2||'';
  const pwd3=state.params.password3||'';

  // Niveau 3 — Titulaire (François) : Chronos + Mnémosyne
  if(pwd3&&val===pwd3){
    closeModal('modalPin');
    isAdmin=true; isTitulaire=true;
    localStorage.setItem('pharmaAccessLevel','titulaire');
    setAdminMode();
    if(state.params.showTuto!==false){setTimeout(()=>openModal('modalTuto'),500);}
    showToast('Mode titulaire 🔓');
    return;
  }
  // Niveau 2 — Admin (Élodie) : Chronos uniquement
  if(val===pwd||(pwd2&&val===pwd2)){
    closeModal('modalPin');
    isAdmin=true; isTitulaire=false;
    localStorage.setItem('pharmaAccessLevel','admin');
    setAdminMode();
    if(state.params.showTuto!==false){setTimeout(()=>openModal('modalTuto'),500);}
    showToast('Mode admin 🔓');
    return;
  }
  document.getElementById('pinError').textContent='Mot de passe incorrect';
  document.getElementById('pinInput').value='';
  document.getElementById('pinInput').focus();
}
function logoutAdmin(){closeModal('modalLogout');isAdmin=false;isTitulaire=false;localStorage.setItem('pharmaAccessLevel','viewer');setViewMode();showToast('Mode visualisation 🔒');}

function setAdminMode(){
  document.getElementById('modeBadge').className='mode-badge admin';
  document.getElementById('modeBadge').textContent=isTitulaire?'🔓 Titulaire':'🔓 Admin';
  const tOnly=document.getElementById('paramsTitulaireOnly');
  if(tOnly)tOnly.style.display=isTitulaire?'block':'none';
  const tabMnemo=document.getElementById('tab-btn-mnemosyne');
  if(tabMnemo)tabMnemo.style.display=isTitulaire?'':'none';
  const panelBtn=document.getElementById('mnePanelBtn');
  if(panelBtn)panelBtn.style.display=isTitulaire?'block':'none';
  document.getElementById('mainNav').classList.remove('hidden');
  document.getElementById('adminBarBtns').style.display='flex';
  document.getElementById('zoomControls').style.display='none';
  document.getElementById('btnNotif').style.display='none';
  const wrap=document.getElementById('planningWrap');
  wrap.classList.add('admin-mode');wrap.style.height='';
  document.getElementById('scaleWrap').style.transform='none';
  renderPlanning();
}
function setViewMode(){
  if(!isViewer){demandCodeVisu();return;}
  _enterViewMode();
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// MNÉMOSYNE
// ═══════════════════════════════════════════════════════════

// ── Données par défaut ──
const JOURS_SEMAINE=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const RITES_EQUIPE_DEFAUT=[
  // LUNDI
  {id:'r001',nom:'Bien penser à — Lundi',freq:'lundi',important:true,postpone:true,perso:false,personnes:[],taches:[{id:'t001',nom:'Plein des sacs',fait:false},{id:'t002',nom:'Verif dus Non réceptionnés',fait:false},{id:'t003',nom:'Laver les blouses',fait:false},{id:'t004',nom:'Verif Test/autotest/Vaccin Covid',fait:false}]},
  {id:'r005',nom:'Bien penser à — Mardi',freq:'mardi',important:true,postpone:false,perso:false,personnes:[],taches:[{id:'t005',nom:'TELETRANS',fait:false},{id:'t006',nom:'VERIF MAD',fait:false},{id:'t007',nom:'NETTOYER AEROSOL',fait:false},{id:'t008',nom:'VERIFIER FIN DE LOC AEROSOL',fait:false}]},
  {id:'r009',nom:'Bien penser à — Mercredi',freq:'mercredi',important:true,postpone:true,perso:false,personnes:[],taches:[{id:'t009',nom:'Vérifier les dus non reçus',fait:false},{id:'t010',nom:'Poubelle',fait:false},{id:'t011',nom:'Cyclamed',fait:false},{id:'t012',nom:'EEG Gondole Libre-accès',fait:false},{id:'t013',nom:'Nettoyage paillasse x2',fait:false}]},
  {id:'r014',nom:'Bien penser à — Jeudi',freq:'jeudi',important:true,postpone:true,perso:false,personnes:[],taches:[{id:'t014',nom:'Ranger le local ortho',fait:false}]},
  {id:'r015',nom:'Bien penser à — Vendredi',freq:'vendredi',important:true,postpone:false,perso:false,personnes:[],taches:[{id:'t015',nom:'Teletrans',fait:false},{id:'t016',nom:'Nettoyer les aerosols',fait:false},{id:'t017',nom:'Vérifier les dus non reçu',fait:false},{id:'t018',nom:'Poubelles',fait:false},{id:'t019',nom:'Cyclamed',fait:false},{id:'t020',nom:'EEG Etagères Blanches',fait:false}]},
  {id:'r020b',nom:'Bien penser à — Samedi',freq:'samedi',important:true,postpone:true,perso:false,personnes:[],taches:[]},
  {id:'r021',nom:'Bien penser à — 1er du mois',freq:'1ermois',important:true,postpone:false,perso:false,personnes:[],taches:[{id:'t021',nom:'Supprimer les promos',fait:false},{id:'t022',nom:'Tour des étiquettes prix',fait:false},{id:'t023',nom:'Périmes Robot',fait:false},{id:'t024',nom:'Périmés Surface de vente',fait:false},{id:'t025',nom:'Tarifier LLD',fait:false}]},
  {id:'r026',nom:'Bien penser à — 15 du mois',freq:'15mois',important:true,postpone:false,perso:false,personnes:[],taches:[{id:'t026',nom:'Supprimer les promos',fait:false},{id:'t027',nom:'Tour des étiquettes prix',fait:false},{id:'t028',nom:'Pile faible des EEG',fait:false}]},
  {id:'r029',nom:'Bien penser à — 1 vendredi sur 2',freq:'1vendredi2',important:true,postpone:false,perso:false,personnes:[],taches:[{id:'t029',nom:'Faire les pleins',fait:false},{id:'t030',nom:'Vérifier flacons ECBU',fait:false},{id:'t031',nom:'Vérifier boites jaunes',fait:false},{id:'t032',nom:'Vérifier kit colorectal',fait:false},{id:'t033',nom:'Vérifier LLD (elodie)',fait:false}]},
  // RITES TITULAIRE
  {id:'r050',nom:'Lundi matin — Titulaire',freq:'lundi',important:true,postpone:true,perso:true,personnes:[],taches:[{id:'tp050',nom:'NPC',fait:false},{id:'tp051',nom:'Coalia à créer',fait:false},{id:'tp052',nom:'Ma Boutique',fait:false},{id:'tp053',nom:'Vérifier FDL (commande CERP)',fait:false},{id:'tp054',nom:'Vérifier MEDSPE',fait:false},{id:'tp055',nom:'Vérifier Masvp',fait:false},{id:'tp056',nom:'Produits dus',fait:false},{id:'tp057',nom:'Dossier en préparation',fait:false},{id:'tp058',nom:'Relire le tableau des actions',fait:false},{id:'tp059',nom:'Changer de blouse',fait:false}]},
  {id:'r060',nom:'Jeudi matin — Titulaire',freq:'jeudi',important:true,postpone:true,perso:true,personnes:[],taches:[{id:'tp060',nom:'Coalia à créer',fait:false},{id:'tp061',nom:'MaBoutique à créer',fait:false},{id:'tp062',nom:'Vérifier les LCR',fait:false},{id:'tp063',nom:'Offre Site UPP',fait:false},{id:'tp064',nom:'Actualités Site UPP',fait:false},{id:'tp065',nom:'Actualité site Pharmacie du Marais',fait:false},{id:'tp066',nom:'Nettoyer Robot Aspirateur',fait:false},{id:'tp067',nom:'Vérifier commandes non réceptionnées',fait:false},{id:'tp068',nom:'Achat selon liste',fait:false}]},
  {id:'r070',nom:'Début de mois — Titulaire',freq:'1ermois',important:true,postpone:false,perso:true,personnes:[],taches:[{id:'tp070',nom:'CA TTC CARMILA',fait:false},{id:'tp071',nom:'Commerce du mois',fait:false},{id:'tp072',nom:'Vazeille — Arrêté de caisse cumulé mensuel',fait:false},{id:'tp073',nom:'Vazeille — Tableau des espèces du mois',fait:false},{id:'tp074',nom:'Vazeille — Export comptable du mois',fait:false},{id:'tp075',nom:'Vazeille — PDF de la banque',fait:false},{id:'tp076',nom:'Excel banque pour retraitement',fait:false},{id:'tp077',nom:'Ordonnancier I et II (Sauvegarde)',fait:false},{id:'tp078',nom:'Ordonnancier Stupéfiants (Sauvegarde)',fait:false},{id:'tp079',nom:'Balance des stups (Impression + Sauvegarde)',fait:false},{id:'tp080',nom:'Crédit',fait:false},{id:'tp081',nom:'Médicaments en avance',fait:false},{id:'tp082',nom:'Facture Hors Télétrans',fait:false},{id:'tp083',nom:'Écarts produits automate (automate)',fait:false},{id:'tp084',nom:'Écarts produits automate (espace de vente)',fait:false},{id:'tp085',nom:'SANOFI Rx',fait:false},{id:'tp086',nom:'UPSA Rx',fait:false},{id:'tp087',nom:'Fabre Rx',fait:false},{id:'tp088',nom:'Top 50',fait:false},{id:'tp089',nom:'Encre imprimante',fait:false},{id:'tp090',nom:'Bobine thermique',fait:false},{id:'tp091',nom:'Ramette de papier',fait:false}]},
  {id:'r092',nom:'Milieu de mois — Titulaire',freq:'15mois',important:true,postpone:false,perso:true,personnes:[],taches:[{id:'tp092',nom:'SANOFI Rx',fait:false},{id:'tp093',nom:'UPSA Rx',fait:false},{id:'tp094',nom:'Top 50',fait:false},{id:'tp095',nom:'Inventaire Robot',fait:false},{id:'tp096',nom:'Écarts produits automate (espace de vente)',fait:false},{id:'tp097',nom:'Litige Digipharmacie',fait:false},{id:'tp098',nom:'Vérifier Avoir',fait:false},{id:'tp099',nom:'Vérifier consommables',fait:false}]},
];

function toggleMneCollapse(listId,chevronId){
  const el=document.getElementById(listId);
  const ch=document.getElementById(chevronId);
  if(!el)return;
  const collapsed=el.style.display==='none';
  el.style.display=collapsed?'block':'none';
  if(ch)ch.textContent=collapsed?'▾':'▸';
}

function initMnemosyne(){
  if(!state.mnemosyne)state.mnemosyne={kairos:[],rites:[],fils:[]};
  if(!state.mnemosyne.kairos)state.mnemosyne.kairos=[];
  if(!state.mnemosyne.fils)state.mnemosyne.fils=[];
  if(!state.mnemosyne.rites||state.mnemosyne.rites.length===0){
    state.mnemosyne.rites=JSON.parse(JSON.stringify(RITES_EQUIPE_DEFAUT));
    saveState();
  } else {
    // Ajouter les rites manquants
    const existingIds=new Set(state.mnemosyne.rites.map(r=>r.id));
    const manquants=RITES_EQUIPE_DEFAUT.filter(r=>!existingIds.has(r.id));
    if(manquants.length>0){
      state.mnemosyne.rites.push(...JSON.parse(JSON.stringify(manquants)));
      saveState();
      console.log('Rites ajoutés:',manquants.map(r=>r.nom));
    }
  }
}

// ── Utilitaires ──
function todayJour(){return JOURS_SEMAINE[new Date().getDay()];}
function todayJourNum(){return new Date().getDay();}
function todayDom(){return new Date().getDate();}
function isRiteActif(rite){
  const j=todayJour();
  const dom=todayDom();
  switch(rite.freq){
    case 'quotidien': return true;
    case 'lundi': return j==='lundi';
    case 'mardi': return j==='mardi';
    case 'mercredi': return j==='mercredi';
    case 'jeudi': return j==='jeudi';
    case 'vendredi': return j==='vendredi';
    case 'samedi': return j==='samedi';
    case '1ermois': return dom===1;
    case '15mois': return dom===15;
    case '1vendredi2':{
      if(j!=='vendredi')return false;
      const start=new Date(2024,0,5); // premier vendredi de référence
      const now=new Date(); now.setHours(0,0,0,0);
      const diff=Math.round((now-start)/(7*86400000));
      return diff%2===0;
    }
    case 'trimestriel': return [1,4,7,10].includes(new Date().getMonth()+1)&&dom===1;
    case 'semestriel': return [1,7].includes(new Date().getMonth()+1)&&dom===1;
    case 'annuel': return new Date().getMonth()===0&&dom===1;
    default: return false;
  }
}

function isRiteConditionRemplie(rite){
  if(!rite.personnes||rite.personnes.length===0)return true;
  const todayStr=dateToStr(new Date());
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open;
  return rite.personnes.some(init=>{
    for(let h=0;h<nbH;h++) if(getCell(todayStr,h,init))return true;
    return false;
  });
}

function getRitesDuJour(){
  const rites=state.mnemosyne?.rites||[];
  const key=new Date().toISOString().slice(0,10);
  const epingles=(state.mnemosyne?.ritesEpingles?.[key])||[];
  const actifs=rites.filter(r=>isRiteActif(r)&&isRiteConditionRemplie(r));
  // Ajouter les rites épinglés non déjà présents
  const actifIds=new Set(actifs.map(r=>r.id));
  epingles.forEach(id=>{
    if(!actifIds.has(id)){
      const r=rites.find(x=>x.id===id);
      if(r)actifs.push(r);
    }
  });
  return actifs;
}

// ── KAIROS ──
function addKairos(){
  const input=document.getElementById('kairosInput');
  const txt=input.value.trim();
  if(!txt)return;
  if(!state.mnemosyne)state.mnemosyne={kairos:[],rites:[],fils:[]};
  state.mnemosyne.kairos.unshift({id:'k'+Date.now(),txt,done:false,postpones:0,date:new Date().toISOString()});
  input.value='';
  saveState();
  renderKairos();
  renderMnePanel();
}

function toggleKairos(id){
  const k=state.mnemosyne.kairos.find(x=>x.id===id);
  if(k){k.done=!k.done;saveState();renderKairos();renderMnePanel();}
}

function postponeKairos(id){
  const k=state.mnemosyne.kairos.find(x=>x.id===id);
  if(k){k.postpones=(k.postpones||0)+1;saveState();renderKairos();}
}

function deleteKairos(id){
  state.mnemosyne.kairos=state.mnemosyne.kairos.filter(x=>x.id!==id);
  saveState();renderKairos();renderMnePanel();
}

function renderKairos(){
  const el=document.getElementById('kairosList');
  if(!el)return;
  const list=state.mnemosyne?.kairos||[];
  if(list.length===0){el.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucune tâche. Tapez et appuyez sur Entrée.</p></div>';return;}
  el.innerHTML=list.map(k=>`
    <div class="kairos-item ${k.done?'done':''}">
      <input type="checkbox" ${k.done?'checked':''} onchange="toggleKairos('${k.id}')" style="width:16px;height:16px;cursor:pointer;flex-shrink:0">
      <span style="flex:1;font-size:.82rem;font-weight:400;cursor:text" ondblclick="editKairosTxt(this,'${k.id}')">${k.txt}</span>
      ${k.postpones>0?`<span class="kairos-badge">${k.postpones}×</span>`:''}
      ${!k.done?`<button onclick="postponeKairos('${k.id}')" title="Reporter" style="background:none;border:none;cursor:pointer;font-size:.9rem;opacity:.6">⏭</button>`:''}
      <button onclick="deleteKairos('${k.id}')" style="background:none;border:none;cursor:pointer;font-size:.9rem;color:#e74c3c;opacity:.7">✕</button>
    </div>`).join('');
}

// ── RITES ──
function getDateKey(){return new Date().toISOString().slice(0,10);}

function isRiteDone(riteId){
  const key=getDateKey();
  return !!(state.mnemosyne?.ritesChecks?.[key]?.[riteId]);
}

function addRiteAuJour(id){addRiteGroupeAuJour(id);}

function addRiteGroupeAuJour(riteId){
  const rite=state.mnemosyne.rites.find(r=>r.id===riteId);
  if(!rite){showToast('Rite introuvable',true);return;}
  if(!state.mnemosyne.ritesEpingles)state.mnemosyne.ritesEpingles={};
  const key=new Date().toISOString().slice(0,10);
  if(!state.mnemosyne.ritesEpingles[key])state.mnemosyne.ritesEpingles[key]=[];
  if(!state.mnemosyne.ritesEpingles[key].includes(riteId)){
    state.mnemosyne.ritesEpingles[key].push(riteId);
    saveState();showToast('📌 Rite ajouté au jour');
  } else {showToast('Déjà ajouté au jour');}
  showMneView('daily');
}

function toggleRite(riteId){
  const key=getDateKey();
  if(!state.mnemosyne.ritesChecks)state.mnemosyne.ritesChecks={};
  if(!state.mnemosyne.ritesChecks[key])state.mnemosyne.ritesChecks[key]={};
  state.mnemosyne.ritesChecks[key][riteId]=!isRiteDone(riteId);
  saveState();renderRitesDuJour();renderMnePanel();
}

function toggleTache(riteId,tacheId){
  const key=getDateKey();
  if(!state.mnemosyne.tachesChecks)state.mnemosyne.tachesChecks={};
  if(!state.mnemosyne.tachesChecks[key])state.mnemosyne.tachesChecks[key]={};
  if(!state.mnemosyne.tachesChecks[key][riteId])state.mnemosyne.tachesChecks[key][riteId]={};
  const done=state.mnemosyne.tachesChecks[key][riteId][tacheId];
  state.mnemosyne.tachesChecks[key][riteId][tacheId]=!done;
  // Si toutes les tâches sont cochées → cocher le rite automatiquement
  const rite=state.mnemosyne.rites.find(r=>r.id===riteId);
  if(rite&&rite.taches&&rite.taches.length>0){
    const tachesDone=state.mnemosyne.tachesChecks[key][riteId];
    const allDone=rite.taches.every(t=>tachesDone[t.id]);
    if(!state.mnemosyne.ritesChecks)state.mnemosyne.ritesChecks={};
    if(!state.mnemosyne.ritesChecks[key])state.mnemosyne.ritesChecks[key]={};
    if(allDone)state.mnemosyne.ritesChecks[key][riteId]=true;
  }
  saveState();renderRitesDuJour();renderMnePanel();
}

function renderRitesDuJour(){
  const elEquipe=document.getElementById('ritesDuJourList');
  const elTitulaire=document.getElementById('ritesTitulaireDuJourList');
  const secTitulaire=document.getElementById('ritesTitulaireSection');
  const label=document.getElementById('ritesDuJourLabel');
  const JFULL=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  if(label)label.textContent=JFULL[new Date().getDay()]+' '+new Date().toLocaleDateString('fr-FR');

  const rites=getRitesDuJour();
  const ritesEquipe=rites.filter(r=>!r.perso);
  const ritesTitulaire=rites.filter(r=>r.perso);

  // Rites équipe
  function renderRiteAvecTaches(r, couleur='var(--mne-vert)'){
    const taches=r.taches||[];
    const key=getDateKey();
    const tachesDone=(state.mnemosyne?.tachesChecks?.[key]?.[r.id])||{};
    const allTachesDone=taches.length>0&&taches.every(t=>tachesDone[t.id]);
    const riteDone=isRiteDone(r.id)||allTachesDone;
    const tachesHtml=taches.filter(t=>!tachesDone[t.id]).map(t=>`
      <div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 20px">
        <input type="checkbox" onchange="toggleTache('${r.id}','${t.id}')" style="width:13px;height:13px;cursor:pointer;flex-shrink:0">
        <span style="font-size:.76rem;font-weight:400">${t.nom}</span>
      </div>`).join('');
    return `<div style="margin-bottom:6px;border-left:3px solid ${couleur};border-radius:0 6px 6px 0;background:#f9f7fc;padding:4px 8px">
      <div style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" ${riteDone?'checked':''} onchange="toggleRite('${r.id}')" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
        <span style="flex:1;font-size:.83rem;font-weight:500;${riteDone?'text-decoration:line-through;opacity:.5':''}">${r.nom}</span>
        ${taches.length?`<span style="font-size:.65rem;color:${couleur}">${Object.values(tachesDone).filter(Boolean).length}/${taches.length}</span>`:''}
      </div>
      ${tachesHtml}
    </div>`;
  }

  if(elEquipe){
    if(ritesEquipe.length===0){
      elEquipe.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucun rite équipe auj.</p></div>';
    } else {
      elEquipe.innerHTML=ritesEquipe.map(r=>renderRiteAvecTaches(r,'var(--mne-vert)')).join('');
    }
  }

  if(secTitulaire)secTitulaire.style.display=isTitulaire?'block':'none';
  if(elTitulaire&&isTitulaire){
    if(ritesTitulaire.length===0){
      elTitulaire.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucun rite titulaire auj.</p></div>';
    } else {
      elTitulaire.innerHTML=ritesTitulaire.map(r=>renderRiteAvecTaches(r,'var(--violet)')).join('');
    }
  }
}

const FREQ_LABELS={lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi','1ermois':'1er du mois','15mois':'15 du mois','1vendredi2':'1 ven./2',trimestriel:'Trimestriel',semestriel:'Semestriel',annuel:'Annuel'};

function _renderRitesGroupe(rites, containerId){
  const el=document.getElementById(containerId);
  if(!el)return;
  if(!rites.length){el.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucun rite.</p></div>';return;}
  el.innerHTML=rites.map(r=>`
    <div style="border:1px solid #e8e0f0;border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f9f7fc">
        <div style="flex:1">
          <div style="font-size:.83rem;font-weight:500">${r.nom}</div>
          <div style="font-size:.7rem;color:var(--gris);margin-top:1px">
            ${FREQ_LABELS[r.freq]||r.freq}
            ${r.dateDebut?` · depuis ${new Date(r.dateDebut).toLocaleDateString('fr-FR')}`:''}
            ${r.personnes&&r.personnes.length?` · ${r.personnes.join(', ')}`:''}
            · ${(r.taches||[]).length} tâche(s)
          </div>
        </div>
        <button onclick="addRiteGroupeAuJour('${r.id}')" title="Ajouter au jour" style="background:none;border:1px solid #9b59b6;border-radius:8px;cursor:pointer;font-size:.72rem;color:#5B2D8E;padding:2px 8px">📌</button>
        <button onclick="openEditRite('${r.id}')" style="background:none;border:1px solid #9b59b6;border-radius:8px;cursor:pointer;font-size:.72rem;color:#5B2D8E;padding:2px 8px">✏</button>
        <button onclick="deleteRite('${r.id}')" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:.85rem">✕</button>
      </div>
      <div style="padding:4px 10px 6px 20px;background:#fff">
        ${(r.taches||[]).map(t=>`<div style="font-size:.75rem;color:#555;padding:1px 0">· ${t.nom}</div>`).join('')
          ||'<div style="font-size:.72rem;color:#ccc;font-style:italic">Aucune tâche</div>'}
      </div>
    </div>`).join('');
}

function renderRitesList(){
  const rites=state.mnemosyne?.rites||[];
  _renderRitesGroupe(rites.filter(r=>!r.perso),'ritesEquipeList');
  _renderRitesGroupe(rites.filter(r=>r.perso),'ritesTitulaireList');
}

// ── RITES ──
let _editRiteId=null; // null = nouveau, string = édition
let _riteTachesTemp=[]; // tâches temporaires dans le modal

function toggleRiteAttribution(){
  const perso=document.getElementById('ritePerso').value==='true';
  const grp=document.getElementById('riteAttributionGroup');
  if(grp)grp.style.display=perso?'none':'block';
}

function openNewRite(perso=false){
  _editRiteId=null;
  _riteTachesTemp=[];
  document.getElementById('modalRiteTitre').textContent='🕯 Nouveau Rite';
  document.getElementById('modalRiteSaveBtn').textContent='✅ Créer';
  document.getElementById('riteNom').value='';
  document.getElementById('riteFrequence').value='lundi';
  document.getElementById('ritePerso').value=perso?'true':'false';
  document.getElementById('ritePostpone').value='true';
  document.getElementById('riteDateDebut').value='';
  toggleRiteAttribution();
  _renderPersonnesCheckboxes([]);
  _renderTachesModal();
  openModal('modalNewRite');
  setTimeout(()=>document.getElementById('riteNom').focus(),100);
}

function openEditRite(id){
  const rite=state.mnemosyne.rites.find(r=>r.id===id);
  if(!rite)return;
  _editRiteId=id;
  _riteTachesTemp=JSON.parse(JSON.stringify(rite.taches||[]));
  document.getElementById('modalRiteTitre').textContent='✏ Modifier le rite';
  document.getElementById('modalRiteSaveBtn').textContent='✅ Enregistrer';
  document.getElementById('riteNom').value=rite.nom||'';
  document.getElementById('riteFrequence').value=rite.freq||'lundi';
  document.getElementById('ritePerso').value=rite.perso?'true':'false';
  document.getElementById('ritePostpone').value=rite.postpone===false?'false':'true';
  document.getElementById('riteDateDebut').value=rite.dateDebut||'';
  toggleRiteAttribution();
  _renderPersonnesCheckboxes(rite.personnes||[]);
  _renderTachesModal();
  openModal('modalNewRite');
}

function _renderPersonnesCheckboxes(selected){
  const emps=state.employes.filter(e=>e.actif!==false);
  document.getElementById('ritePersonnesCheckboxes').innerHTML=emps.map(e=>`
    <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer">
      <input type="checkbox" value="${e.init}" ${selected.includes(e.init)?'checked':''} style="width:14px;height:14px">
      <span class="emp-badge" style="background:${e.color};color:${tc(e.color)};font-size:.65rem">${e.init}</span>
      ${e.nom}
    </label>`).join('');
}

function _renderTachesModal(){
  const el=document.getElementById('riteTachesList');
  if(!el)return;
  if(!_riteTachesTemp.length){
    el.innerHTML='<p style="color:var(--gris);font-size:.78rem;font-style:italic;margin-bottom:4px">Aucune tâche — ajoutez-en ci-dessous.</p>';
    return;
  }
  el.innerHTML=_riteTachesTemp.map((t,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:#f9f7fc;margin-bottom:3px">
      <span style="color:var(--gris);font-size:.75rem;cursor:grab">⠿</span>
      <span style="flex:1;font-size:.8rem;font-weight:400;cursor:text" 
        ondblclick="editTacheModalNom(this,${i})">${t.nom}</span>
      <button onclick="deleteTacheModal(${i})" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:.8rem">✕</button>
    </div>`).join('');
}

function ajouterTacheModal(){
  const input=document.getElementById('nouvelleTacheRite');
  const nom=input.value.trim();
  if(!nom)return;
  _riteTachesTemp.push({id:'t'+Date.now(),nom,fait:false});
  input.value='';
  _renderTachesModal();
  input.focus();
}

function deleteTacheModal(i){
  _riteTachesTemp.splice(i,1);
  _renderTachesModal();
}

function editTacheModalNom(el,i){
  const old=el.textContent;
  el.contentEditable='true';el.focus();
  const range=document.createRange();range.selectNodeContents(el);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  const done=()=>{
    el.contentEditable='false';
    const v=el.textContent.trim();
    if(v&&v!==old){_riteTachesTemp[i].nom=v;_renderTachesModal();}
    else el.textContent=old;
  };
  el.onblur=done;
  el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done();}if(e.key==='Escape'){el.textContent=old;el.contentEditable='false';}};
}

function saveRite(){
  const nom=document.getElementById('riteNom').value.trim();
  if(!nom){showToast('Entrez un nom',true);return;}
  const personnes=[...document.querySelectorAll('#ritePersonnesCheckboxes input:checked')].map(cb=>cb.value);
  const rite={
    id:_editRiteId||('r'+Date.now()),
    nom,
    freq:document.getElementById('riteFrequence').value,
    perso:document.getElementById('ritePerso').value==='true',
    postpone:document.getElementById('ritePostpone').value==='true',
    dateDebut:document.getElementById('riteDateDebut').value||'',
    personnes,
    taches:JSON.parse(JSON.stringify(_riteTachesTemp))
  };
  if(!state.mnemosyne.rites)state.mnemosyne.rites=[];
  if(_editRiteId){
    const idx=state.mnemosyne.rites.findIndex(r=>r.id===_editRiteId);
    if(idx>=0)state.mnemosyne.rites[idx]=rite;
  } else {
    state.mnemosyne.rites.push(rite);
  }
  saveState();
  closeModal('modalNewRite');
  renderRitesList();
  renderRitesDuJour();
  showToast(_editRiteId?'✅ Rite modifié':'✅ Rite créé');
}

function deleteRite(id){
  if(!confirm('Supprimer ce rite ?'))return;
  state.mnemosyne.rites=state.mnemosyne.rites.filter(r=>r.id!==id);
  saveState();renderRitesList();renderRitesDuJour();
  showToast('Rite supprimé');
}

function saveNewRite(){saveRite();}// compatibilité

// ── FIL D'ARIANE ──
const FIL_COLORS=['#534AB7','#0F6E56','#993C1D','#185FA5','#3B6D11','#854F0B'];

function filUid(){return'fn'+Date.now()+Math.random().toString(36).slice(2,5);}
function filFindNode(id,node){
  if(node.id===id)return node;
  for(const c of(node.children||[])){const f=filFindNode(id,c);if(f)return f;}
  return null;
}
function filPathTo(id,node,path=[]){
  if(node.id===id)return[...path,node];
  for(const c of(node.children||[])){const p=filPathTo(id,c,[...path,node]);if(p)return p;}
  return null;
}
function filTrunc(s,n){return s.length>n?s.slice(0,n)+'…':s;}
function filLayout(node,depth=0,yOff=0){
  node._d=depth;node._x=depth*(FIL_W+FIL_PX);
  const kids=node.children||[];
  if(!kids.length){node._y=yOff;node._span=FIL_H;return FIL_H+FIL_PY;}
  let y=yOff,tot=0;
  kids.forEach(k=>{const s=filLayout(k,depth+1,y);y+=s;tot+=s;});
  node._y=(node.children[0]._y+node.children[node.children.length-1]._y)/2;
  return tot;
}

function openFilDetail(filId,nodeId){
  _currentFilId=filId;
  const fil=state.mnemosyne.fils.find(f=>f.id===filId);
  if(!fil)return;
  if(!fil.tree){
    fil.tree={id:filUid(),name:fil.nom||fil.titre||'Racine',done:false,children:[],entries:[]};
    if(fil.notes&&fil.notes.length)fil.tree.entries=[...fil.notes];
    saveState();
  }
  _currentFilNodeId=nodeId||fil.tree.id;
  const titleEl=document.getElementById('filDetailTitre');
  const dateEl=document.getElementById('filDetailDate');
  const statutEl=document.getElementById('filDetailStatut');
  if(titleEl)titleEl.textContent=fil.nom||fil.titre||'Dossier';
  if(dateEl)dateEl.textContent='Créé le '+new Date(fil.cree).toLocaleDateString('fr-FR');
  if(statutEl)statutEl.value=fil.statut||'ouvert';
  renderFilTree(fil);
  renderFilNode(fil,_currentFilNodeId);
  openModal('modalFilDetail');
  setTimeout(()=>{renderFilTree(fil);renderFilNode(fil,_currentFilNodeId);},50);
}

function filAllDone(n){return n.done===true||(n.children&&n.children.length>0&&n.children.every(c=>filAllDone(c)));}
function filCanDone(n){return!n.done&&(n.children||[]).every(c=>filAllDone(c));}
function filAllDoneStrict(n){return n.done===true;}
function filCountAll(n){let t=0,d=0;function w(x){t++;if(filAllDone(x))d++;(x.children||[]).forEach(w);}w(n);return{t,d};}

const FIL_H_NODE=26,FIL_CK=16,FIL_FONT=11;

function filMeasureW(txt){
  const wrap=document.getElementById('filTreeWrap');
  if(!wrap)return 100;
  let svg=wrap.querySelector('svg');
  if(!svg){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');wrap.appendChild(svg);}
  const t=document.createElementNS('http://www.w3.org/2000/svg','text');
  t.style.fontSize=FIL_FONT+'px';t.textContent=txt;svg.appendChild(t);
  const w=t.getBBox().width;t.remove();
  return Math.max(w+FIL_CK+28,70);
}

function filCollectByDepth(node,depth=0,map={}){
  if(!map[depth])map[depth]=[];
  node._d=depth;
  node._w=filMeasureW(node.name);
  map[depth].push(node);
  (node.children||[]).forEach(c=>filCollectByDepth(c,depth+1,map));
  return map;
}

function filComputeColX(depthMap){
  const depths=Object.keys(depthMap).map(Number).sort((a,b)=>a-b);
  const colX={};let x=0;
  depths.forEach(d=>{
    colX[d]=x;
    const maxW=Math.max(...depthMap[d].map(n=>n._w));
    depthMap[d].forEach(n=>n._colW=maxW);
    x+=maxW+48;
  });
  return colX;
}

function filAssignX(node,colX){node._x=colX[node._d];(node.children||[]).forEach(c=>filAssignX(c,colX));}

function filAssignY(node,yOff=0){
  const kids=node.children||[];
  if(!kids.length){node._y=yOff;return FIL_H_NODE+10;}
  let y=yOff,tot=0;
  kids.forEach(k=>{const s=filAssignY(k,y);y+=s;tot+=s;});
  node._y=(kids[0]._y+kids[kids.length-1]._y)/2;
  return tot;
}

function filUpdateProgress(fil){
  const prog=document.getElementById('filProgress');
  const badge=document.getElementById('filStatutBadge');
  if(!prog||!fil.tree)return;
  const{t,d}=filCountAll(fil.tree);
  const pct=t?Math.round(d/t*100):0;
  prog.style.width=pct+'%';
  const ptxt=document.getElementById('filProgressTxt');
  if(ptxt)ptxt.textContent=`${d}/${t}`;
  if(pct===100){
    if(badge){badge.textContent='Clos ✓';badge.style.background='#e8f7e5';badge.style.color='#27ae60';}
    if(document.getElementById('filDetailStatut'))document.getElementById('filDetailStatut').value='clos';
    fil.statut='clos';saveState();
  } else if(pct>0){
    if(badge){badge.textContent='En cours';badge.style.background='#fff3cd';badge.style.color='#b8860b';}
  } else {
    if(badge){badge.textContent='Ouvert';badge.style.background='#EEEDFE';badge.style.color='#534AB7';}
  }
}

function renderFilTree(fil){
  const wrap=document.getElementById('filTreeWrap');
  if(!wrap)return;
  // Layout colonnes alignées
  const depthMap=filCollectByDepth(fil.tree);
  const colX=filComputeColX(depthMap);
  filAssignX(fil.tree,colX);
  filAssignY(fil.tree,0);
  const all=[];function col(n){all.push(n);(n.children||[]).forEach(col);}col(fil.tree);
  const W=Math.max(...all.map(n=>n._x+n._colW))+10;
  const H2=Math.max(...all.map(n=>n._y+FIL_H_NODE))+10;
  let s=`<svg width="${Math.max(W,300)}" height="${Math.max(H2,80)}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">`;

  function dn(node){
    const{_x:x,_y:y,_w:nw,_colW:cw,_d:d}=node;
    const col=FIL_COLORS[d%FIL_COLORS.length];
    const lt=FIL_COLORS[d%FIL_COLORS.length]+'22';
    const isSel=_currentFilNodeId===node.id;
    const isDone=node.done;
    const canDo=filCanDone(node);
    const badge=(node.entries||[]).length;
    const h=FIL_H_NODE;

    (node.children||[]).forEach(child=>{
      const sx=x+nw,sy=y+h/2,ex=child._x,ey=child._y+h/2;
      const midX=x+cw+24;
      const lc=filAllDone(child)?'#27ae60':FIL_COLORS[(d+1)%FIL_COLORS.length];
      s+=`<path d="M${sx},${sy} C${midX},${sy} ${midX},${ey} ${ex},${ey}" fill="none" stroke="${lc}" stroke-width="${filAllDone(child)?2:1.5}" opacity="${filAllDone(child)?'.7':'.4'}"/>`;
    });

    const fill=isDone?'#e8f7e5':isSel?lt:'#fff';
    const stroke=isDone?'#27ae60':isSel?col:'#d0c8e8';
    const sw=isDone||isSel?2:1;

    s+=`<g class="fil-nd" data-nid="${node.id}" style="cursor:pointer">
      <rect x="${x}" y="${y}" width="${nw}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    // Coche gauche
    const ckF=isDone?'#27ae60':canDo?'#e8f7e5':'#f0f0f0';
    const ckS=isDone?'#27ae60':canDo?'#27ae60':'#ccc';
    s+=`<g class="fil-bck" data-nid="${node.id}" style="cursor:${canDo||isDone?'pointer':'not-allowed'}">
      <rect x="${x+3}" y="${y+5}" width="${FIL_CK}" height="${FIL_CK}" rx="3" fill="${ckF}" stroke="${ckS}" stroke-width="1.5"/>`;
    if(isDone)s+=`<text x="${x+3+FIL_CK/2}" y="${y+16}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">✓</text>`;
    else if(canDo)s+=`<text x="${x+3+FIL_CK/2}" y="${y+16}" text-anchor="middle" font-size="10" fill="#27ae60">✓</text>`;
    s+=`</g>`;

    // Texte (non tronqué — largeur adaptée)
    s+=`<text class="fil-nodename" data-nid="${node.id}" x="${x+FIL_CK+8}" y="${y+h/2+4}" font-size="${FIL_FONT}" fill="${isDone?'#27ae60':isSel?col:'#333'}" font-weight="${isSel&&!isDone?'500':'400'}" text-decoration="${isDone?'line-through':'none'}" style="cursor:text">${node.name}</text>`;

    // Badge entrées
    if(badge)s+=`<rect x="${x+nw-20}" y="${y+4}" width="15" height="${h-8}" rx="7" fill="${isDone?'#27ae60':col}"/><text x="${x+nw-12.5}" y="${y+h/2+4}" text-anchor="middle" font-size="9" fill="#fff">${badge}</text>`;

    // + et − si sélectionné
    if(isSel){
      s+=`<g class="fil-badd" data-nid="${node.id}"><rect x="${x+nw-32}" y="${y+4}" width="13" height="${h-8}" rx="3" fill="${lt}"/><text x="${x+nw-25.5}" y="${y+h/2+4}" text-anchor="middle" font-size="14" fill="${col}">+</text></g>`;
      s+=`<g class="fil-bdel" data-nid="${node.id}"><rect x="${x+nw-17}" y="${y+4}" width="13" height="${h-8}" rx="3" fill="#fee2e2"/><text x="${x+nw-10.5}" y="${y+h/2+4}" text-anchor="middle" font-size="14" fill="#b91c1c">−</text></g>`;
    }
    s+=`</g>`;
    (node.children||[]).forEach(dn);
  }
  dn(fil.tree);
  s+=`</svg>`;
  wrap.innerHTML=s;
  filUpdateProgress(fil);
  filBindEvents(fil,wrap);
}

function filBindEvents(fil,wrap){
  wrap.querySelectorAll('.fil-nd').forEach(g=>{
    g.addEventListener('click',e=>{
      if(e.target.closest('.fil-badd,.fil-bdel,.fil-bck,.fil-nodename'))return;
      _currentFilNodeId=g.dataset.nid;
      renderFilTree(fil);renderFilNode(fil,_currentFilNodeId);
    });
    g.addEventListener('dblclick',e=>{
      if(e.target.closest('.fil-badd,.fil-bdel,.fil-bck'))return;
      const node=filFindNode(g.dataset.nid,fil.tree);if(!node)return;
      const v=prompt('Renommer :',node.name);
      if(v&&v.trim()){node.name=v.trim();_currentFilNodeId=node.id;saveState();renderFilTree(fil);renderFilNode(fil,node.id);}
    });
  });
  wrap.querySelectorAll('.fil-nodename').forEach(t=>{
    t.addEventListener('dblclick',e=>{
      e.stopPropagation();
      const node=filFindNode(t.dataset.nid,fil.tree);if(!node)return;
      const v=prompt('Renommer :',node.name);
      if(v&&v.trim()){node.name=v.trim();_currentFilNodeId=node.id;saveState();renderFilTree(fil);renderFilNode(fil,node.id);}
    });
  });
  wrap.querySelectorAll('.fil-bck').forEach(g=>{
    g.addEventListener('click',e=>{
      e.stopPropagation();
      const node=filFindNode(g.dataset.nid,fil.tree);if(!node)return;
      if(node.done){node.done=false;}
      else if(filCanDone(node)){node.done=true;}
      else{
        const rem=(node.children||[]).filter(c=>!filAllDone(c)).length;
        showToast(`Terminez d'abord les ${rem} branche(s)`,true);return;
      }
      _currentFilNodeId=node.id;saveState();renderFilTree(fil);renderFilNode(fil,node.id);
    });
  });
  wrap.querySelectorAll('.fil-badd').forEach(g=>{
    g.addEventListener('click',e=>{
      e.stopPropagation();
      const node=filFindNode(g.dataset.nid,fil.tree);if(!node)return;
      const name=prompt('Nom de la branche :');if(!name)return;
      node.children=node.children||[];
      const newNode={id:filUid(),name,done:false,children:[],entries:[]};
      node.children.push(newNode);
      _currentFilNodeId=newNode.id;saveState();renderFilTree(fil);renderFilNode(fil,newNode.id);
    });
  });
  wrap.querySelectorAll('.fil-bdel').forEach(g=>{
    g.addEventListener('click',e=>{
      e.stopPropagation();
      const nid=g.dataset.nid;
      if(nid===fil.tree.id){showToast('Impossible de supprimer la racine',true);return;}
      if(!confirm('Supprimer ce noeud et ses branches ?'))return;
      function removeFrom(parent){parent.children=(parent.children||[]).filter(c=>{if(c.id===nid)return false;removeFrom(c);return true;});}
      removeFrom(fil.tree);
      _currentFilNodeId=fil.tree.id;saveState();renderFilTree(fil);renderFilNode(fil,fil.tree.id);
    });
  });
}

function renderFilNode(fil,nodeId){
  const node=filFindNode(nodeId,fil.tree);
  if(!node)return;
  const pathEl=document.getElementById('filNodePath');
  if(pathEl){
    const path=filPathTo(nodeId,fil.tree)||[];
    pathEl.innerHTML=path.map((n,i)=>`<span style="color:#5B2D8E;cursor:pointer;font-weight:500" onclick="_selectFilNode('${n.id}')">${n.name}</span>${i<path.length-1?' › ':''}`).join('');
  }
  const nameEl=document.getElementById('filNodeName');
  if(nameEl)nameEl.textContent=node.name;
  const tl=document.getElementById('filNodeTimeline');
  if(!tl)return;
  const entries=node.entries||[];
  if(!entries.length){tl.innerHTML='<div style="text-align:center;color:#999;padding:10px;font-size:.8rem;font-style:italic">Aucune entrée</div>';return;}
  const ICONS={note:'📝',action:'✅',echeance:'📅'};
  tl.innerHTML='<div style="position:relative;padding-left:20px">'
    +'<div style="position:absolute;left:8px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,#5B2D8E,#3DB830)"></div>'
    +[...entries].reverse().map(e=>`
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">
      <div class="fil-tl-dot ${e.type||'note'}" style="position:relative;z-index:1">${ICONS[e.type||'note']}</div>
      <div class="fil-tl-content">
        <div style="font-size:.65rem;color:#999;margin-bottom:2px">${new Date(e.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        <div style="font-size:.8rem;line-height:1.4">${e.txt}</div>
        ${e.echeance?`<div style="font-size:.7rem;color:#e67e22;font-weight:600;margin-top:2px">📅 ${new Date(e.echeance).toLocaleDateString('fr-FR')}</div>`:''}
      </div>
    </div>`).join('')+'</div>';
}

window._selectFilNode=function(nid){
  const fil=state.mnemosyne.fils.find(f=>f.id===_currentFilId);
  if(!fil)return;
  _currentFilNodeId=nid;renderFilTree(fil);renderFilNode(fil,nid);
};

function addFilChild(){
  const fil=state.mnemosyne.fils.find(f=>f.id===_currentFilId);
  if(!fil||!fil.tree)return;
  const parent=filFindNode(_currentFilNodeId,fil.tree);
  if(!parent)return;
  const name=prompt('Nom de la branche :');
  if(!name)return;
  parent.children=parent.children||[];
  const newNode={id:filUid(),name,children:[],entries:[]};
  parent.children.push(newNode);
  _currentFilNodeId=newNode.id;
  saveState();renderFilTree(fil);renderFilNode(fil,newNode.id);
}

function openNewFil(){
  document.getElementById('filTitre').value='';
  document.getElementById('filStatut').value='ouvert';
  document.getElementById('filNote').value='';
  openModal('modalNewFil');
}

function saveNewFil(){
  const titre=document.getElementById('filTitre').value.trim();
  if(!titre){showToast('Entrez un titre',true);return;}
  const note=document.getElementById('filNote').value.trim();
  const fil={
    id:'f'+Date.now(),
    titre,
    statut:document.getElementById('filStatut').value,
    notes:note?[{txt:note,date:new Date().toISOString()}]:[],
    cree:new Date().toISOString()
  };
  if(!state.mnemosyne.fils)state.mnemosyne.fils=[];
  state.mnemosyne.fils.unshift(fil);
  saveState();closeModal('modalNewFil');renderFilList();
  showToast('✅ Dossier créé');
}

function renderFilList(){
  const el=document.getElementById('filList');
  if(!el)return;
  const fils=(state.mnemosyne?.fils||[]).filter(f=>f.statut!=='clos');
  if(fils.length===0){el.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucun dossier actif.</p></div>';return;}
  el.innerHTML=fils.map(f=>`
    <div class="fil-item" onclick="openFilDetail('${f.id}',null)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
        <span class="fil-titre">${f.titre}</span>
        <span class="fil-statut ${f.statut}">${f.statut}</span>
      </div>
      ${f.notes&&f.notes.length>0?`<div class="fil-note">${f.notes[f.notes.length-1].txt.slice(0,80)}${f.notes[f.notes.length-1].txt.length>80?'…':''}</div>`:''}
      <div style="font-size:.65rem;color:var(--gris);margin-top:2px">${f.notes?.length||0} note(s) · ${new Date(f.cree).toLocaleDateString('fr-FR')}</div>
    </div>`).join('');
}

let _filCurrentType='note';

function addFilChild(){
  const fil=state.mnemosyne.fils.find(f=>f.id===_currentFilId);
  if(!fil||!fil.tree)return;
  const parent=filFindNode(_currentFilNodeId,fil.tree);
  if(!parent)return;
  const name=prompt('Nom de la branche :');
  if(!name)return;
  parent.children=parent.children||[];
  const newNode={id:filUid(),name,children:[],entries:[]};
  parent.children.push(newNode);
  _currentFilNodeId=newNode.id;
  saveState();
  renderFilTree(fil);
  renderFilNode(fil,newNode.id);
}

function setFilType(type){
  _filCurrentType=type;
  ['note','action','echeance'].forEach(t=>{
    const btn=document.getElementById('ftp-'+t);
    if(btn){
      btn.classList.toggle('active',t===type);
    }
  });
  const ef=document.getElementById('filEcheanceField');
  if(ef)ef.style.display=type==='echeance'?'block':'none';
  const labels={note:'Votre note...',action:'Action à réaliser...',echeance:'Description de l\'échéance...'};
  const inp=document.getElementById('filNouvelleNote');
  if(inp)inp.placeholder=labels[type]||'';
}


function addFilNote(){
  const txt=document.getElementById('filNouvelleNote').value.trim();
  if(!txt||!_currentFilId||!_currentFilNodeId)return;
  const fil=state.mnemosyne.fils.find(x=>x.id===_currentFilId);
  if(!fil||!fil.tree)return;
  const node=filFindNode(_currentFilNodeId,fil.tree);
  if(!node)return;
  if(!node.entries)node.entries=[];
  const entry={txt,type:_filCurrentType,date:new Date().toISOString()};
  if(_filCurrentType==='echeance'){
    const d=document.getElementById('filEcheanceDate')?.value;
    if(d)entry.echeance=d;
  }
  node.entries.push(entry);
  document.getElementById('filNouvelleNote').value='';
  if(document.getElementById('filEcheanceDate'))document.getElementById('filEcheanceDate').value='';
  saveState();
  renderFilTree(fil);
  renderFilNode(fil,_currentFilNodeId);
  renderFilList();
  renderFilListAll();
}

function updateFilStatut(){
  const f=state.mnemosyne.fils.find(x=>x.id===_currentFilId);
  if(!f)return;
  f.statut=document.getElementById('filDetailStatut').value;
  saveState();renderFilList();
}

function deleteFil(){
  if(!confirm('Supprimer ce dossier ?'))return;
  state.mnemosyne.fils=state.mnemosyne.fils.filter(x=>x.id!==_currentFilId);
  saveState();closeModal('modalFilDetail');renderFilList();
}

// ── PANNEAU LATÉRAL ──
function toggleMnePanel(){
  const p=document.getElementById('mnePanel');
  const isOpen=p.style.right==='0px';
  p.style.right=isOpen?'-320px':'0px';
  if(!isOpen)renderMnePanel();
}
function closeMnePanel(){
  const p=document.getElementById('mnePanel');
  if(p)p.style.right='-320px';
}

function renderMnePanel(){
  // Date
  const d=document.getElementById('mnePanelDate');
  if(d)d.textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  // Kairos
  const kEl=document.getElementById('mnePanelKairos');
  if(kEl){
    const pending=(state.mnemosyne?.kairos||[]).filter(k=>!k.done);
    kEl.innerHTML=pending.length===0?'<p style="font-size:.75rem;color:var(--gris)">Aucune tâche en cours</p>':
      pending.map(k=>`<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #eee">
        <input type="checkbox" onchange="toggleKairos('${k.id}')" style="width:14px;height:14px;cursor:pointer;flex-shrink:0">
        <span style="flex:1;font-size:.76rem">${k.txt}${k.postpones>0?` <span style="background:#5B2D8E;color:#fff;border-radius:8px;padding:1px 5px;font-size:.6rem">${k.postpones}×</span>`:''}</span>
        <button onclick="postponeKairos('${k.id}')" title="Reporter" style="background:none;border:none;cursor:pointer;font-size:.85rem;opacity:.6;padding:0">⏭</button>
      </div>`).join('');
  }
  // Rites du jour
  const rEl=document.getElementById('mnePanelRites');
  if(rEl){
    const tous=getRitesDuJour().filter(r=>!r.perso||isTitulaire);
    const equipe=tous.filter(r=>!r.perso);
    const titulaire=tous.filter(r=>r.perso);
    const key=getDateKey();
    const renderRitesPanneau=r=>{
      const taches=r.taches||[];
      const tachesDone=(state.mnemosyne?.tachesChecks?.[key]?.[r.id])||{};
      const tachesRestantes=taches.filter(t=>!tachesDone[t.id]);
      const tachesHtml=tachesRestantes.map(t=>`
        <div style="display:flex;align-items:center;gap:5px;padding:2px 0 2px 16px">
          <input type="checkbox" onchange="toggleTache('${r.id}','${t.id}')" style="width:12px;height:12px;cursor:pointer">
          <span style="font-size:.72rem">${t.nom}</span>
        </div>`).join('');
      return `<div style="padding:3px 0;border-bottom:1px solid #eee">
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" ${isRiteDone(r.id)?'checked':''} onchange="toggleRite('${r.id}')" style="width:14px;height:14px;cursor:pointer">
          <span style="font-size:.76rem;font-weight:500;${isRiteDone(r.id)?'text-decoration:line-through;opacity:.5':''}">${r.nom}</span>
          ${taches.length?`<span style="font-size:.65rem;color:#999">${Object.values(tachesDone).filter(Boolean).length}/${taches.length}</span>`:''}
        </div>
        ${tachesHtml}
      </div>`;
    };
    let html='';
    if(equipe.length){
      const equipeUniques=[...new Map(equipe.map(r=>[r.id,r])).values()];
      html+=`<div style="font-size:.68rem;font-weight:600;color:#0F6E56;margin-bottom:3px">🕯 Équipe</div>`;
      html+=equipeUniques.map(renderRitesPanneau).join('');
    }
    if(isTitulaire&&titulaire.length){
      // Dédoublonner par id
      const titUniques=[...new Map(titulaire.map(r=>[r.id,r])).values()];
      html+=`<div style="font-size:.68rem;font-weight:600;color:#5B2D8E;margin-top:8px;margin-bottom:3px">🔐 Titulaire</div>`;
      html+=titUniques.map(renderRitesPanneau).join('');
    }
    rEl.innerHTML=html||'<p style="font-size:.75rem;color:var(--gris)">Aucun rite auj.</p>';
  }
}

// ── Impression des Rites ──
function imprimerRitesDuJour(){
  const rites=getRitesDuJour().filter(r=>!r.perso);
  const JFULL=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const jour=JFULL[new Date().getDay()];
  const date=new Date().toLocaleDateString('fr-FR');
  const lignes=rites.map(r=>`
    <div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #eee">
      <div style="width:18px;height:18px;border:2px solid #333;border-radius:2px;flex-shrink:0"></div>
      <span style="${r.important?'font-weight:700;font-size:14px':'font-size:13px'}">${r.nom}</span>
    </div>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rites ${jour}</title>
<style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif}</style>
</head><body>
<div style="font-size:11px;color:#888;margin-bottom:4px">⚕ Pharmacie du Marais</div>
<div style="font-size:20px;font-weight:700;margin-bottom:4px">${jour}</div>
<div style="font-size:13px;font-weight:700;margin-bottom:16px">BIEN PENSER À :</div>
${lignes}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`;
  const w=window.open('','_blank');
  w.document.write(html);w.document.close();
}

// ── Init tab Mnémosyne ──
let _mneCurrentView='daily';

function showMneView(view){
  _mneCurrentView=view;
  document.getElementById('mneDailyView').style.display=view==='daily'?'block':'none';
  document.getElementById('mneConfigView').style.display=view==='config'?'block':'none';
  document.getElementById('mneViewBtn').className='mne-btn '+(view==='daily'?'mne-btn-violet':'mne-btn-ghost');
  document.getElementById('mneConfigBtn').className='mne-btn '+(view==='config'?'mne-btn-violet':'mne-btn-ghost');
  if(view==='config'){renderRitesList();renderFilListAll();}
  else{renderKairos();renderRitesDuJour();renderFilList();}
}

function renderFilListAll(){
  const el=document.getElementById('filListAll');
  if(!el)return;
  const fils=state.mnemosyne?.fils||[];
  if(fils.length===0){el.innerHTML='<div class="empty" style="padding:.5rem"><p>Aucun dossier.</p></div>';return;}
  el.innerHTML=fils.map(f=>`
    <div class="fil-item" onclick="openFilDetail('${f.id}',null)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
        <span class="fil-titre">${f.titre}</span>
        <span class="fil-statut ${f.statut}">${f.statut}</span>
      </div>
      <div style="font-size:.65rem;color:var(--gris)">${f.notes?.length||0} note(s) · ${new Date(f.cree).toLocaleDateString('fr-FR')}</div>
    </div>`).join('');
}

function renderMnemosyne(){
  initMnemosyne();
  showMneView(_mneCurrentView);
}

function showTab(name,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');btn.classList.add('active');

  if(name==='projets'){renderMasqueActuel();renderProjetsList();renderProjetsMasqueListe();document.getElementById('projetsListView').style.display='block';document.getElementById('projetsEditorView').style.display='none';}
  if(name==='historique'){renderHistorique();listerSauvegardes();}
  if(name==='mnemosyne'){renderMnemosyne();}
  if(name==='recap')initRecap();
  if(name==='params')initNotifSection();
}

// ═══════════════════════════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// AUTO SCALE
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// IMPORT MASQUE
// ═══════════════════════════════════════════════════════════
let _masqueDateDebut=null;

function openImportMasque(){
  const d=new Date(),day=d.getDay(),diff=(1+7-day)%7||7;
  d.setDate(d.getDate()+diff);
  document.getElementById('masqueDateDebutInput').value=d.toISOString().split('T')[0];
  openModal('modalMasqueDate');
}

function confirmerImportMasque(){
  const dateStr=document.getElementById('masqueDateDebutInput').value;
  if(!dateStr){showToast('Choisissez une date',true);return;}
  _masqueDateDebut=dateStr;
  closeModal('modalMasqueDate');
  document.getElementById('masqueInput').click();
}

function updateMasqueStatus(){
  const el=document.getElementById('masqueStatus');
  if(!el)return;
  if(state.masque&&state.masqueStart){
    const d=strToDate(state.masqueStart);
    el.innerHTML=`✅ Masque chargé — début le <b>${d.toLocaleDateString('fr-FR')}</b>`;
    renderMasquePreview();
  }else{
    el.textContent='Aucun masque chargé.';
  }
}

function importMasque(input){
  const file=input.files[0];if(!file)return;input.value='';
  document.getElementById('masqueStatus').textContent='⏳ Chargement…';
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true,raw:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
      const open=state.params.open||9,close=state.params.close||19,nbH=close-open,nbEmp=state.employes.length;
      const masqueSemaines=[];
      for(let si=0;si<2;si++){
        const semDef=XL_SEM[si],cells=[];
        for(let ji=0;ji<6;ji++){
          const jourCells=[];
          for(let h=0;h<nbH;h++){
            const row=raw[semDef.data_start+h]||[],hArr=new Array(nbEmp).fill(false);
            const hObj={};
            for(let ei=0;ei<nbEmp;ei++){
              const emp=state.employes[ei],xlEi=XL_EMPS.indexOf(emp.init);
              if(xlEi===-1)continue;
              const val=row[XL_JOUR_EMP[ji]+xlEi];
              hObj[emp.init]=!!(val&&String(val).trim()!=='');
            }
            jourCells.push(hObj);
          }
          cells.push(jourCells);
        }
        masqueSemaines.push({cells});
      }
      // Lire la date de début depuis l'Excel
      let masqueStart=null;
      const hrow=raw[XL_SEM[0].header]||[];
      for(let c=0;c<hrow.length;c++){
        const v=hrow[c];
        if(v instanceof Date){masqueStart=dateToStr(v);break;}
        if(typeof v==='string'&&v.match(/\d{1,2}\/\d{1,2}\/\d{4}/)){
          const p=v.split('/');masqueStart=`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;break;
        }
      }
      state.masque=masqueSemaines;
      // Utiliser la date saisie explicitement
      state.masqueStart=_masqueDateDebut||dateToStr(new Date());
      _masqueDateDebut=null;
      // Vider les overrides pour repartir propre
      state.calendar={};
      saveState();
      updateMasqueStatus();
      goToday();
      showToast('Masque chargé ✅');
    }catch(err){
      document.getElementById('masqueStatus').innerHTML=`<span style="color:var(--alerte)">❌ ${err.message}</span>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function clearMasque(){
  if(!confirm('Effacer le masque et toutes les modifications ?'))return;
  state.masque=null;state.masqueStart=null;state.calendar={};
  saveState();updateMasqueStatus();
  document.getElementById('scaleWrap').innerHTML='<div class="empty"><div class="big">📋</div><p>Chargez un masque pour commencer.</p></div>';
  showToast('Masque effacé');
}

function renderMasquePreview(){
  const el=document.getElementById('masquePreview');if(!el)return;
  if(!state.masque){el.style.display='none';return;}
  el.style.display='block';
  const open=state.params.open||9,close=state.params.close||19,nbH=close-open,emps=state.employes;
  let html='<table style="border-collapse:collapse;font-size:.62rem;white-space:nowrap"><tr><td></td>';
  for(let si=0;si<2;si++){
    JOURS.forEach(j=>{
      html+=`<th colspan="${emps.length}" style="background:${si===0?'#1a4a34':'#1a3a5c'};color:#fff;padding:2px 3px;border:1px solid rgba(255,255,255,.2)">${j.substring(0,3)} S${si+1}</th>`;
      html+='<th style="width:2px;background:#888"></th>';
    });
  }
  html+='</tr><tr><td></td>';
  for(let si=0;si<2;si++){
    JOURS.forEach((_,ji)=>{
      emps.forEach(e=>html+=`<td style="background:${e.color};color:${tc(e.color)};text-align:center;padding:1px;font-weight:700;font-size:.58rem;border:1px solid rgba(0,0,0,.1)">${e.init}</td>`);
      html+='<td style="width:2px;background:#ccc"></td>';
    });
  }
  html+='</tr>';
  for(let h=0;h<nbH;h++){
    html+=`<tr><td style="background:#f0f4f2;padding:1px 4px;font-weight:700;color:#555;font-size:.6rem;text-align:right">${open+h}h</td>`;
    for(let si=0;si<2;si++){
      JOURS.forEach((_,ji)=>{
        emps.forEach((e,ei)=>{
          const on=state.masque[si].cells[ji]?.[h]?.[ei]||false;
          html+=`<td style="width:14px;height:12px;background:${on?e.color:'#fff'};border:1px solid #ddd"></td>`;
        });
        html+='<td style="width:2px;background:#ccc"></td>';
      });
    }
    html+='</tr>';
  }
  html+='</table>';
  document.getElementById('masquePreviewTable').innerHTML=html;
}

// ═══════════════════════════════════════════════════════════
// IMPORT PERIODE EXCEL
// ═══════════════════════════════════════════════════════════
let _importDateDebut=null;
function openImportPeriode(){
  const d=new Date(),day=d.getDay(),diff=(1+7-day)%7||7;d.setDate(d.getDate()+diff);
  document.getElementById('importDateDebut').value=d.toISOString().split('T')[0];
  openModal('modalImportDate');
}
function confirmerImportPeriode(){
  const dateStr=document.getElementById('importDateDebut').value;
  if(!dateStr){showToast('Choisissez une date',true);return;}
  _importDateDebut=new Date(dateStr);
  closeModal('modalImportDate');
  document.getElementById('xlsxInputImport').click();
}

function importExcel(input){
  const file=input.files[0];if(!file)return;input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true,raw:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
      let dateDebut=_importDateDebut;_importDateDebut=null;
      if(!dateDebut){const d=new Date(),day=d.getDay(),diff=(1+7-day)%7||7;d.setDate(d.getDate()+diff);dateDebut=d;}
      const open=state.params.open||9,close=state.params.close||19,nbH=close-open,nbEmp=state.employes.length;
      let totalCells=0;
      for(let si=0;si<4;si++){
        const semDef=XL_SEM[si];
        for(let ji=0;ji<6;ji++){
          const d=strToDate(addDays(dateToStr(dateDebut),si*7+ji));
          const ds=dateToStr(d);
          const jourCells=[];
          for(let h=0;h<nbH;h++){
            const row=raw[semDef.data_start+h]||[];
            const hObj={};
            for(let ei=0;ei<nbEmp;ei++){
              const emp=state.employes[ei],xlEi=XL_EMPS.indexOf(emp.init);
              if(xlEi===-1)continue;
              const val=row[XL_JOUR_EMP[ji]+xlEi];
              if(val&&String(val).trim()!==''){hObj[emp.init]=true;totalCells++;}
            }
            jourCells.push(hObj);
          }
          state.calendar[ds]=jourCells;
        }
      }
      if(!state.masqueStart)state.masqueStart=dateToStr(dateDebut);
      if(!state.currentBlockStart)state.currentBlockStart=dateToStr(dateDebut);
      saveState();renderPlanning();
      showToast(`✅ ${totalCells} cases importées`);
    }catch(err){
      showToast('Erreur import: '+err.message,true);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════════════════
// EMPLOYES
// ═══════════════════════════════════════════════════════════
function updateMeHFields(){
  const rot=parseInt(document.getElementById('meRotation').value)||2;
  const container=document.getElementById('meHFields');
  let html='';
  for(let i=0;i<rot;i++){
    html+=`<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:70px">
      <label style="font-size:.72rem;font-weight:600">H contrat S${i+1}</label>
      <input type="number" id="meHS${i}" min="0" max="48" value="35" style="padding:5px 7px;border:1.5px solid var(--bordure);border-radius:6px;font-size:.79rem;text-align:center">
    </div>`;
  }
  container.innerHTML=html;
}


// ═══════════════════════════════════════════════════════════
// EMPLOYÉS — DRAG & DROP + TOGGLE ACTIF
// ═══════════════════════════════════════════════════════════
let _dragIdx=null;

function empDragStart(e,i){
  _dragIdx=i;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function empDragOver(e,i){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  if(i!==_dragIdx) e.currentTarget.classList.add('drag-over');
}
function empDragLeave(e){ e.currentTarget.classList.remove('drag-over'); }
function empDrop(e,i){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(_dragIdx===null||_dragIdx===i)return;
  const emps=state.employes;
  const moved=emps.splice(_dragIdx,1)[0];
  emps.splice(i,0,moved);
  _dragIdx=null;
  saveState();renderEmpList();renderPlanning();
}
function empDragEnd(e){
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.emp-row').forEach(r=>r.classList.remove('drag-over'));
  _dragIdx=null;
}

function toggleActifEmp(i,val){
  const emp=state.employes[i];
  emp.actif=val;
  if(!val&&state.masque){
    // D'abord migrer si nécessaire
    migrateCalendarFormat();
    // Retirer du masque
    for(let si=0;si<2;si++){
      for(let ji=0;ji<6;ji++){
        const cells=state.masque[si]?.cells[ji];
        if(!cells)continue;
        for(let h=0;h<cells.length;h++){
          if(cells[h]&&!Array.isArray(cells[h]))cells[h][emp.init]=false;
          else if(Array.isArray(cells[h])){
            // Ancien format — convertir d'abord
            const newRow={};
            cells[h].forEach((v,ei)=>{if(state.employes[ei])newRow[state.employes[ei].init]=v;});
            newRow[emp.init]=false;
            cells[h]=newRow;
          }
        }
      }
    }
    // Retirer du calendar
    Object.keys(state.calendar).forEach(ds=>{
      const day=state.calendar[ds];
      if(!day)return;
      for(let h=0;h<day.length;h++){
        if(day[h]&&!Array.isArray(day[h]))day[h][emp.init]=false;
        else if(Array.isArray(day[h])){
          const newRow={};
          day[h].forEach((v,ei)=>{if(state.employes[ei])newRow[state.employes[ei].init]=v;});
          newRow[emp.init]=false;
          day[h]=newRow;
        }
      }
    });
  }
  saveState();renderEmpList();renderPlanning();renderMasqueActuel();
  showToast(val?`${emp.init} activé`:`${emp.init} désactivé`);
}

function renderEmpList(){
  const rows=state.employes.map((e,i)=>{
    const rot=e.rotation||2;
    const hps=e.heuresParSemaine||[e.heures||35];
    const actif=e.actif!==false;
    const hCells=Array.from({length:rot},(_,si)=>`
      <td style="padding:3px 2px">
        <div style="font-size:.6rem;color:var(--gris);text-align:center;margin-bottom:1px">S${si+1}</div>
        <input type="number" value="${hps[si]||35}" min="0" max="48"
          onchange="updateEmpHPS(${i},${si},this.value)"
          style="width:38px;padding:2px 3px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.74rem;text-align:center">
      </td>`).join('');
    return `<tr class="${actif?'':'inactif'}" draggable="true"
      ondragstart="empDragStart(event,${i})"
      ondragover="empDragOver(event,${i})"
      ondragleave="empDragLeave(event)"
      ondrop="empDrop(event,${i})"
      ondragend="empDragEnd(event)"
      style="border-bottom:1px solid var(--bordure);${i%2===0?'background:#f9fbfa':'background:#fff'}">
      <td style="padding:4px 4px;width:18px;color:var(--gris);cursor:grab;text-align:center">⠿</td>
      <td style="padding:4px 3px;width:28px">
        <input type="color" value="${e.color}" onchange="state.employes[${i}].color=this.value;saveState();renderPlanning();renderEmpList()"
          style="width:24px;height:24px;padding:1px;border:1px solid var(--bordure);cursor:pointer;border-radius:4px;display:block">
      </td>
      <td style="padding:4px 4px;width:36px">
        <span class="emp-badge" style="background:${e.color};color:${tc(e.color)}">${e.init}</span>
      </td>
      <td style="padding:4px 4px;min-width:100px">
        <input value="${e.nom}" placeholder="Prénom Nom" onchange="state.employes[${i}].nom=this.value;saveState()"
          style="width:100%;padding:3px 5px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.78rem">
      </td>
      <td style="padding:4px 4px;min-width:140px">
        <input type="email" value="${e.email||''}" placeholder="email@exemple.fr" onchange="state.employes[${i}].email=this.value;saveState()"
          style="width:100%;padding:3px 5px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.74rem">
      </td>
      <td style="padding:4px 4px;width:120px">
        <input type="date" value="${e.dateNaissance||''}" title="Date de naissance" onchange="state.employes[${i}].dateNaissance=this.value;saveState()"
          style="width:100%;padding:3px 4px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.72rem">
      </td>
      <td style="padding:4px 4px;width:120px">
        <input type="date" value="${e.dateEntree||''}" title="Date d'entrée" onchange="state.employes[${i}].dateEntree=this.value;saveState()"
          style="width:100%;padding:3px 4px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.72rem">
      </td>
      <td style="padding:4px 3px;width:36px;text-align:center">
        <input type="number" value="${rot}" min="1" max="4" onchange="updateEmpRotation(${i},this.value)"
          style="width:32px;padding:2px 3px;border:1.5px solid var(--bordure);border-radius:5px;font-size:.74rem;text-align:center">
      </td>
      ${hCells}
      <td style="padding:4px 6px;width:44px;text-align:center">
        <input type="checkbox" ${e.titulaire?'checked':''} title="Titulaire"
          onchange="state.employes[${i}].titulaire=this.checked;saveState()"
          style="width:16px;height:16px;cursor:pointer">
      </td>
      <td style="padding:4px 6px;width:44px">
        <label class="toggle-actif" title="${actif?'Désactiver':'Activer'}">
          <input type="checkbox" ${actif?'checked':''} onchange="toggleActifEmp(${i},this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td style="padding:4px 3px;width:28px">
        <button class="btn btn-danger btn-sm" onclick="removeEmp(${i})" style="opacity:1 !important;padding:2px 6px">✕</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('empList').innerHTML=`
  <table style="width:100%;border-collapse:collapse;font-size:.78rem">
    <thead>
      <tr style="background:var(--vert-clair);border-bottom:2px solid var(--bordure)">
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:18px"></th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:28px">Coul.</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:36px">Init.</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;text-align:left">Nom</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;text-align:left">Email</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:120px">Naissance</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:120px">Entrée</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:36px;text-align:center">Rot.</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;text-align:center" colspan="2">H/sem</th>
        <th style="padding:5px 4px;font-size:.68rem;color:var(--gris);font-weight:700;width:44px;text-align:center">Tit.</th>
        <th style="width:44px"></th>
        <th style="width:28px"></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function updateEmpRotation(i,val){
  const rot=Math.max(1,Math.min(4,parseInt(val)||2));
  state.employes[i].rotation=rot;
  const cur=state.employes[i].heuresParSemaine||[state.employes[i].heures||35];
  // Ajuster le tableau heuresParSemaine à la nouvelle taille
  const newHps=Array.from({length:rot},(_,si)=>cur[si]||cur[cur.length-1]||35);
  state.employes[i].heuresParSemaine=newHps;
  state.employes[i].heures=newHps[0];
  saveState();renderEmpList();renderPlanning();
}


function updateEmpHPS(i,si,val){
  const h=parseInt(val)||0;
  if(!state.employes[i].heuresParSemaine)state.employes[i].heuresParSemaine=[state.employes[i].heures||35];
  state.employes[i].heuresParSemaine[si]=h;
  state.employes[i].heures=state.employes[i].heuresParSemaine[0];
  saveState();renderPlanning();
}

function openAddEmp(){
  document.getElementById('meInit').value='';document.getElementById('meNom').value='';
  document.getElementById('meEmail').value='';
  document.getElementById('meDateNaissance').value='';
  document.getElementById('meDateEntree').value='';
  document.getElementById('meRotation').value=2;
  document.getElementById('meColor').value=EXCEL_COLORS[state.employes.length%EXCEL_COLORS.length];
  updateMeHFields();
  openModal('modalEmp');
}
function confirmAddEmp(){
  const init=document.getElementById('meInit').value.toUpperCase().trim();
  if(!init){showToast('Initiales requises',true);return;}
  const rot=parseInt(document.getElementById('meRotation').value)||2;
  const hps=Array.from({length:rot},(_,si)=>parseInt(document.getElementById(`meHS${si}`)?.value)||0);
  state.employes.push({
    init,
    nom:document.getElementById('meNom').value.trim()||init,
    email:document.getElementById('meEmail').value.trim(),
    dateNaissance:document.getElementById('meDateNaissance').value||'',
    dateEntree:document.getElementById('meDateEntree').value||'',
    heures:hps[0],
    heuresParSemaine:hps,
    rotation:rot,
    color:document.getElementById('meColor').value,
    actif:true
  });
  saveState();closeModal('modalEmp');renderEmpList();renderPlanning();showToast('Ajouté');
}
function removeEmp(i){
  if(!confirm(`Supprimer ${state.employes[i].init} ?`))return;
  state.employes.splice(i,1);saveState();renderEmpList();renderPlanning();showToast('Supprimé');
}
function saveEmps(){saveState();renderPlanning();showToast('Enregistré');}

// ═══════════════════════════════════════════════════════════
// PARAMS
// ═══════════════════════════════════════════════════════════
function saveParams(){
  const g=id=>document.getElementById(id);
  if(g('pNom'))state.params.nom=g('pNom').value;
  if(g('pPhpUrl'))state.params.phpUrl=g('pPhpUrl').value;
  if(g('pSaveUrl'))state.params.saveUrl=g('pSaveUrl').value;
  if(g('pSubject'))state.params.subject=g('pSubject').value;
  if(g('pIntro'))state.params.intro=g('pIntro').value;
  if(g('pOpen'))state.params.open=parseInt(g('pOpen').value);
  if(g('pClose'))state.params.close=parseInt(g('pClose').value);
  const pwd=g('pPassword')?.value?.trim();if(pwd)state.params.password=pwd;
  const vpwd=g('pViewPassword')?.value?.trim();if(vpwd)state.params.viewPassword=vpwd;
  const pwd2=g('pPassword2')?.value?.trim();if(pwd2!==undefined&&pwd2!=='')state.params.password2=pwd2;
  const pwd3=g('pPassword3')?.value?.trim();if(pwd3!==undefined&&pwd3!=='')state.params.password3=pwd3;
  const ae=g('pAdminEmail');if(ae)state.params.adminEmail=ae.value.trim();
  const ki=g('pKairosInit');if(ki)state.params.kairosInit=ki.value.trim();
  const st=g('pShowTuto');if(st)state.params.showTuto=(st.value==='true');
  saveState();
  showToast('✅ Paramètres enregistrés');
}
function applyParams(){
  document.getElementById('pNom').value=state.params.nom||'Pharmacie de Lempdes';
  document.getElementById('pPhpUrl').value=state.params.phpUrl||'';
  const sv=document.getElementById('pSaveUrl');if(sv)sv.value=state.params.saveUrl||'';
  const vp=document.getElementById('pViewPassword');if(vp)vp.value='';
  const p2=document.getElementById('pPassword2');if(p2)p2.value=state.params.password2||'';
  const p3=document.getElementById('pPassword3');if(p3)p3.value=state.params.password3||'';
  const ae=document.getElementById('pAdminEmail');if(ae)ae.value=state.params.adminEmail||'';
  const ki=document.getElementById('pKairosInit');if(ki)ki.value=state.params.kairosInit||'FF';
  const st=document.getElementById('pShowTuto');if(st)st.value=state.params.showTuto===false?'false':'true';
  document.getElementById('pSubject').value=state.params.subject||'Planning de la semaine — Pharmacie de Lempdes';
  document.getElementById('pIntro').value=state.params.intro||'';
  const o=document.getElementById('pOpen'),c=document.getElementById('pClose');
  if(o.options.length>0){o.value=state.params.open||9;c.value=state.params.close||19;}
}

// ═══════════════════════════════════════════════════════════
// LOG
// ═══════════════════════════════════════════════════════════

function renderLog(){
  const el=document.getElementById('logList');if(!el)return;
  el.innerHTML=state.log.length===0?'<div class="empty" style="padding:.5rem"><p>Aucun envoi.</p></div>'
    :state.log.map(l=>`<div class="log-item ${l.ok?'log-ok':'log-err'}"><span>${l.msg}</span><span class="log-time">${l.time}</span></div>`).join('');
}


// ═══════════════════════════════════════════════════════════
// MODALS / TOAST
// ═══════════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function showToast(msg,err=false){
  const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(err?' err':'')+' show';
  setTimeout(()=>t.classList.remove('show'),3000);
}

init();
