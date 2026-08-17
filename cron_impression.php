<?php
// ============================================================
// CRON_IMPRESSION.PHP — Impression automatique des Rites à 10h
// L'imprimante Brother reçoit l'email et imprime automatiquement
// ============================================================
ini_set('display_errors',0);
error_reporting(0);
header('Content-Type: application/json');

$TOKEN='pharmacie-lempdes-cron-2026';
if(($_GET['token']??'')!==$TOKEN){
    http_response_code(403); echo json_encode(['ok'=>false,'error'=>'Accès refusé']); exit;
}

$data=json_decode(file_get_contents(__DIR__.'/planning_data.json'),true)??[];
$rites=$data['mnemosyne']['rites']??[];
$employes=$data['employes']??[];

// Config Gmail
// Config SMTP Infomaniak
function lireSMTP_imp():array{
    $f=__DIR__.'/send_mail.php';
    if(!file_exists($f))return['host'=>'mail.infomaniak.com','port'=>587,'user'=>'','pass'=>''];
    $c=file_get_contents($f);
    preg_match('#\$SMTP_HOST\s*=\s*["\']([^"\']+)["\']#',$c,$mH);
    preg_match('#\$SMTP_PORT\s*=\s*(\d+)#',$c,$mP);
    preg_match('#\$SMTP_USER\s*=\s*["\']([^"\']+)["\']#',$c,$mU);
    preg_match('#\$SMTP_PASS\s*=\s*["\']([^"\']+)["\']#',$c,$mPw);
    return['host'=>$mH[1]??'mail.infomaniak.com','port'=>(int)($mP[1]??587),'user'=>$mU[1]??'','pass'=>$mPw[1]??''];
}
$smtp=lireSMTP_imp();
$PRINTER_EMAIL='impressionphiedumarais@gmail.com';

// Jour actuel
$jours=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
$mois=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
$jourIdx=(int)date('w');
$jourNom=$jours[$jourIdx];
$dom=(int)date('j');
$moisNom=$mois[(int)date('n')-1];
$annee=date('Y');
$JFULL=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
$jourLabel=$JFULL[$jourIdx].' '.$dom.' '.$moisNom.' '.$annee;

// Déterminer les fréquences actives aujourd'hui
function freqActive(string $freq, int $jourIdx, int $dom):bool{
    $map=['lundi'=>1,'mardi'=>2,'mercredi'=>3,'jeudi'=>4,'vendredi'=>5,'samedi'=>6];
    if(isset($map[$freq]))return $map[$freq]===$jourIdx;
    if($freq==='1ermois')return $dom===1;
    if($freq==='15mois')return $dom===15;
    if($freq==='1vendredi2'){
        if($jourIdx!==5)return false;
        $start=new DateTime('2024-01-05');
        $now=new DateTime();$now->setTime(0,0,0);
        $diff=(int)$start->diff($now)->days;
        return $diff%2===0;
    }
    return false;
}

// Vérifier présence d'un employé dans le planning
function estPresentAujourdhui(array $data, string $init):bool{
    $today=date('Y-m-d');
    $calendar=$data['calendar']??[];
    $params=$data['params']??[];
    $open=(int)($params['open']??9);
    $close=(int)($params['close']??19);
    $nbH=$close-$open;
    if(isset($calendar[$today])){
        for($h=0;$h<$nbH;$h++){
            $row=$calendar[$today][$h]??[];
            if(is_array($row)&&!empty($row[$init]))return true;
        }
        return false;
    }
    $masque=$data['masque']??[];
    $masqueStart=$data['masqueStart']??'';
    if(!$masque||!$masqueStart)return false;
    $startDate=new DateTime($masqueStart);
    $todayDate=new DateTime($today);
    $diff=(int)$startDate->diff($todayDate)->days;
    $si=($diff>=7)?1:0;
    $ji=(int)(new DateTime($today))->format('N')-1;
    if($ji>=6)return false;
    if(!isset($masque[$si]['cells'][$ji]))return false;
    for($h=0;$h<$nbH;$h++){
        $row=$masque[$si]['cells'][$ji][$h]??[];
        if(is_array($row)&&!empty($row[$init]))return true;
    }
    return false;
}

// Filtrer les rites équipe du jour
$ritesAujourdhui=array_filter($rites,function($r) use($jourIdx,$dom,$data){
    if(!empty($r['perso']))return false; // Pas les rites titulaire
    if(!freqActive($r['freq']??'',$jourIdx,$dom))return false;
    // Vérifier présence si conditionné
    if(!empty($r['personnes'])){
        $present=false;
        foreach($r['personnes'] as $init){
            if(estPresentAujourdhui($data,$init)){$present=true;break;}
        }
        if(!$present)return false;
    }
    return true;
});

if(empty($ritesAujourdhui)){
    echo json_encode(['ok'=>true,'nb'=>0,'message'=>'Aucun rite équipe à imprimer aujourd\'hui']);
    exit;
}

// Générer le HTML au format "BIEN PENSER À"
$html='<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;margin:20px;max-width:500px}
  h1{font-size:16px;font-weight:bold;margin-bottom:4px}'.$jourLabel.'
  h2{font-size:14px;font-weight:bold;margin-bottom:16px}
  ul{list-style:none;padding:0;margin:0}
  li{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
  .cb{width:16px;height:16px;border:2px solid #333;display:inline-block;flex-shrink:0}
  .important{font-weight:bold}
</style></head><body>';

foreach($ritesAujourdhui as $rite){
    $html.='<h1>'.htmlspecialchars($rite['nom']).'</h1>';
    $html.='<h2>BIEN PENSER À :</h2><ul>';
    $taches=$rite['taches']??[];
    if(empty($taches)){
        $html.='<li><span class="cb"></span> '.htmlspecialchars($rite['nom']).'</li>';
    } else {
        foreach($taches as $t){
            $html.='<li><span class="cb"></span> <span>'.htmlspecialchars($t['nom']).'</span></li>';
        }
    }
    $html.='</ul><br>';
}
$html.='</body></html>';

// Envoyer par email à l'imprimante
function envoyerImpression(string $to,string $subject,string $html,string $user,string $pass,string $host='mail.infomaniak.com',int $port=587):bool{
    $sock=stream_socket_client("tcp://{$host}:{$port}",$errno,$errstr,15);
    if(!$sock){file_put_contents(__DIR__.'/debug_smtp.txt',"Connexion failed {$host}:{$port}: ".$errstr);return false;}
    stream_set_timeout($sock,15);
    function sc($s,$c){fwrite($s,$c."\r\n");return sr($s);}
    function sr($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
    sr($sock);sc($sock,'EHLO localhost');sc($sock,'STARTTLS');
    stream_socket_enable_crypto($sock,true,STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc($sock,'EHLO localhost');sc($sock,'AUTH LOGIN');
    sc($sock,base64_encode($user));
    $r=sc($sock,base64_encode($pass));
    if(strpos($r,'235')===false&&strpos($r,'334')===false){fclose($sock);file_put_contents(__DIR__.'/debug_smtp.txt','AUTH failed: '.$r);return false;}
    sc($sock,"MAIL FROM:<$user>");
    sc($sock,"RCPT TO:<$to>");
    sc($sock,'DATA');
    $sub='=?UTF-8?B?'.base64_encode($subject).'?=';
    $msg="From: Pharmacie du Marais <$user>\r\nTo: $to\r\nSubject: $sub\r\n";
    $msg.="MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg.=chunk_split(base64_encode($html),76,"\r\n")."\r\n.";
    $r2=sc($sock,$msg);sc($sock,'QUIT');fclose($sock);
    return strpos($r2,'250')!==false;
}

$subject='Rites du '.$jourLabel;
$ok=envoyerImpression($PRINTER_EMAIL,$subject,$html,$smtp['user'],$smtp['pass'],$smtp['host'],$smtp['port']);

echo json_encode([
    'ok'=>$ok,
    'nb'=>count($ritesAujourdhui),
    'jour'=>$jourLabel,
    'rites'=>array_values(array_map(fn($r)=>$r['nom'],$ritesAujourdhui))
]);
