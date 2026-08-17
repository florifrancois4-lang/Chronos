<?php
// ============================================================
// CRON_ANNIVERSAIRE.PHP
// À lancer chaque jour à 9h
// Alertes :
// 1) Veille anniversaire naissance → toute l'équipe sauf la personne
// 2) J-7 anniversaire ancienneté → titulaires uniquement
// 3) 1er janvier → récap ancienneté → titulaires
// ============================================================
ini_set('display_errors',0);
error_reporting(0);
header('Content-Type: application/json');

$TOKEN='pharmacie-lempdes-cron-2026';
if(($_GET['token']??'')!==$TOKEN){
    http_response_code(403); echo json_encode(['ok'=>false,'error'=>'Accès refusé']); exit;
}

$data=json_decode(file_get_contents(__DIR__.'/planning_data.json'),true)??[];
$employes=$data['employes']??[];
$actifs=array_values(array_filter($employes,fn($e)=>($e['actif']??true)!==false));
$titulaires=array_values(array_filter($actifs,fn($e)=>!empty($e['titulaire'])));

// Fonctions SMTP
function lireSMTP_ann():array{
    $f=__DIR__.'/send_mail.php';
    if(!file_exists($f))return['host'=>'','port'=>587,'user'=>'','pass'=>''];
    $c=file_get_contents($f);
    preg_match('#\$SMTP_HOST\s*=\s*["\']([^"\']+)["\']#',$c,$mH);
    preg_match('#\$SMTP_PORT\s*=\s*(\d+)#',$c,$mP);
    preg_match('#\$SMTP_USER\s*=\s*["\']([^"\']+)["\']#',$c,$mU);
    preg_match('#\$SMTP_PASS\s*=\s*["\']([^"\']+)["\']#',$c,$mPw);
    return['host'=>$mH[1]??'mail.infomaniak.com','port'=>(int)($mP[1]??587),'user'=>$mU[1]??'','pass'=>$mPw[1]??''];
}
function sc_ann($s,$c){fwrite($s,$c."\r\n");return sr_ann($s);}
function sr_ann($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
function envoyerHTML_ann(string $to,string $subject,string $html,array $cfg):bool{
    if(!$cfg['pass']||!$to)return false;
    $sock=stream_socket_client("tcp://{$cfg['host']}:{$cfg['port']}",$errno,$errstr,15);
    if(!$sock)return false;
    stream_set_timeout($sock,15);
    sr_ann($sock);sc_ann($sock,"EHLO localhost");sc_ann($sock,"STARTTLS");
    stream_socket_enable_crypto($sock,true,STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc_ann($sock,"EHLO localhost");sc_ann($sock,"AUTH LOGIN");
    sc_ann($sock,base64_encode($cfg['user']));
    $r=sc_ann($sock,base64_encode($cfg['pass']));
    if(strpos($r,'235')===false&&strpos($r,'334')===false){fclose($sock);return false;}
    sc_ann($sock,"MAIL FROM:<{$cfg['user']}>");
    sc_ann($sock,"RCPT TO:<$to>");sc_ann($sock,"DATA");
    $sub='=?UTF-8?B?'.base64_encode($subject).'?=';
    $name='=?UTF-8?B?'.base64_encode('Pharmacie du Marais').'?=';
    $msg="From: {$name} <{$cfg['user']}>\r\nTo: $to\r\nSubject: $sub\r\n";
    $msg.="MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg.=chunk_split(base64_encode($html),76,"\r\n")."\r\n.";
    $r2=sc_ann($sock,$msg);sc_ann($sock,"QUIT");fclose($sock);
    return strpos($r2,'250')!==false;
}

function htmlEnvelope(string $titre, string $corps, string $sous=''):string{
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;padding:16px;background:#f4f6f5">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
  <div style="background:#1a6b4a;padding:14px;color:#fff">
    <div style="font-size:14px;font-weight:700">⚕ Pharmacie du Marais</div>
    <div style="font-size:13px;font-weight:600;margin-top:4px">'.$titre.'</div>
    '.($sous?'<div style="font-size:11px;opacity:.8;margin-top:2px">'.$sous.'</div>':'').'
  </div>
  <div style="padding:16px;font-size:14px;line-height:1.7">'.$corps.'</div>
</div></body></html>';
}

$smtp=lireSMTP_ann();
$today=new DateTime();
$today->setTime(0,0,0);
$todayMD=$today->format('m-d');
$isJanvier1=($todayMD==='01-01');
$sent=[];

// ── 1. VEILLE ANNIVERSAIRE NAISSANCE → toute l'équipe sauf la personne ──
foreach($actifs as $emp){
    if(empty($emp['dateNaissance']))continue;
    $naissance=new DateTime($emp['dateNaissance']);
    $annivMD=$naissance->format('m-d');
    // Demain
    $demain=(clone $today)->modify('+1 day');
    $demainMD=$demain->format('m-d');
    if($annivMD!==$demainMD)continue;

    $age=$today->diff($naissance)->y+1; // âge demain
    $nom=$emp['nom']??$emp['init'];
    $sujet="🎂 Anniversaire de {$nom} demain !";
    $corps="<p>Demain <strong>".htmlspecialchars($nom)."</strong> fête ses <strong>{$age} ans</strong> !</p>
<p style='color:#666;font-size:12px'>N'oubliez pas de lui souhaiter son anniversaire 🎉</p>";
    $html=htmlEnvelope("🎂 Anniversaire demain",$corps,$demain->format('d/m/Y'));

    // Envoyer à tous sauf la personne concernée
    foreach($actifs as $dest){
        if(empty($dest['email']))continue;
        if($dest['init']===$emp['init'])continue; // pas à la personne
        if(envoyerHTML_ann($dest['email'],$sujet,$html,$smtp)) $sent[]="Anniv ".$nom." → ".$dest['email'];
        usleep(200000);
    }
}

// ── 2. J-7 ANNIVERSAIRE ANCIENNETÉ → titulaires uniquement ──
if(!empty($titulaires)){
    foreach($actifs as $emp){
        if(empty($emp['dateEntree']))continue;
        $entree=new DateTime($emp['dateEntree']);
        $annivMD=$entree->format('m-d');
        $dans7=(clone $today)->modify('+7 days');
        $dans7MD=$dans7->format('m-d');
        if($annivMD!==$dans7MD)continue;

        $annees=$today->diff($entree)->y+1;
        $nom=$emp['nom']??$emp['init'];
        $sujet="🏆 Ancienneté de {$nom} dans 7 jours";
        $corps="<p>Dans 7 jours, <strong>".htmlspecialchars($nom)."</strong> fêtera ses <strong>{$annees} ans d'ancienneté</strong> à la pharmacie.</p>
<p>Date d'entrée : <strong>".$entree->format('d/m/Y')."</strong></p>";
        $html=htmlEnvelope("🏆 Anniversaire d'ancienneté",$corps,$dans7->format('d/m/Y'));

        foreach($titulaires as $tit){
            if(empty($tit['email']))continue;
            if(envoyerHTML_ann($tit['email'],$sujet,$html,$smtp)) $sent[]="Ancienneté ".$nom." → ".$tit['email'];
            usleep(200000);
        }
    }
}

// ── 3. 1er JANVIER → RÉCAP ANCIENNETÉ → titulaires ──
if($isJanvier1&&!empty($titulaires)){
    $anneeEnCours=(int)$today->format('Y');
    $lignes='<table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#e8f4ef">
        <th style="padding:8px;text-align:left;border:1px solid #cde8d8">Employé</th>
        <th style="padding:8px;text-align:left;border:1px solid #cde8d8">Date d\'entrée</th>
        <th style="padding:8px;text-align:center;border:1px solid #cde8d8">Ancienneté</th>
      </tr>';
    foreach($actifs as $emp){
        if(empty($emp['dateEntree']))continue;
        $entree=new DateTime($emp['dateEntree']);
        $annees=$today->diff($entree)->y;
        $nom=$emp['nom']??$emp['init'];
        $lignes.='<tr>
          <td style="padding:8px;border:1px solid #ddd">'.htmlspecialchars($nom).'</td>
          <td style="padding:8px;border:1px solid #ddd">'.$entree->format('d/m/Y').'</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center"><strong>'.$annees.' an'.($annees>1?'s':'').'</strong></td>
        </tr>';
    }
    $lignes.='</table>';
    $corps="<p>Bonne année ! Voici le récapitulatif des anciennetés de votre équipe au 1er janvier {$anneeEnCours} :</p>".$lignes;
    $html=htmlEnvelope("📋 Récap ancienneté {$anneeEnCours}",$corps,"1er janvier {$anneeEnCours}");
    $sujet="📋 Récap ancienneté équipe — ".$anneeEnCours;

    foreach($titulaires as $tit){
        if(empty($tit['email']))continue;
        if(envoyerHTML_ann($tit['email'],$sujet,$html,$smtp)) $sent[]="Récap ancienneté → ".$tit['email'];
        usleep(200000);
    }
}

echo json_encode(['ok'=>true,'sent'=>count($sent),'details'=>$sent]);
