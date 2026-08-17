<?php
// ============================================================
// CRON_KAIROS.PHP — Notifications push Kairos
// Déclencher toutes les heures via CRON
// Alerte si François est présent au planning ce jour
// ============================================================
ini_set('display_errors',0);
error_reporting(0);
header('Content-Type: application/json');

$TOKEN='pharmacie-lempdes-cron-2026';
if(($_GET['token']??'')!==$TOKEN){
    http_response_code(403); echo json_encode(['ok'=>false,'error'=>'Accès refusé']); exit;
}

$data=json_decode(file_get_contents(__DIR__.'/planning_data.json'),true)??[];
$params=$data['params']??[];
$mnemosyne=$data['mnemosyne']??[];
$kairos=array_values(array_filter($mnemosyne['kairos']??[],fn($k)=>empty($k['done'])));

if(empty($kairos)){
    echo json_encode(['ok'=>true,'nb'=>0,'message'=>'Aucun Kairos en cours']); exit;
}

$kairosInit=trim($params['kairosInit']??'FF');
$today=date('Y-m-d');

// Vérifier l'heure — pas de rappel entre 20h et 8h
$heure=(int)date('G');
if($heure>=20||$heure<8){
    echo json_encode(['ok'=>true,'nb'=>0,'message'=>'Hors plage horaire ('.$heure.'h)']); exit;
}


function estPresent(array $data, string $init, string $today):bool{
    $calendar=$data['calendar']??[];
    $params=$data['params']??[];
    $open=(int)($params['open']??9);
    $close=(int)($params['close']??19);
    $nbH=$close-$open;

    // Vérifier le calendar (overrides)
    if(isset($calendar[$today])){
        for($h=0;$h<$nbH;$h++){
            $row=$calendar[$today][$h]??[];
            if(is_array($row)&&!empty($row[$init]))return true;
        }
        // Si le jour est dans le calendar mais pas présent → absent
        return false;
    }

    // Sinon vérifier le masque
    $masque=$data['masque']??[];
    $masqueStart=$data['masqueStart']??'';
    if(!$masque||!$masqueStart)return false;

    $startDate=new DateTime($masqueStart);
    $todayDate=new DateTime($today);
    $diff=(int)$startDate->diff($todayDate)->days;
    $si=($diff>=7)?1:0;
    $ji=(int)(new DateTime($today))->format('N')-1; // 0=lundi, 6=dimanche

    if($ji>=6)return false; // samedi/dimanche pas dans masque standard
    if(!isset($masque[$si]['cells'][$ji]))return false;

    for($h=0;$h<$nbH;$h++){
        $row=$masque[$si]['cells'][$ji][$h]??[];
        if(is_array($row)&&!empty($row[$init]))return true;
    }
    return false;
}

if(!estPresent($data,$kairosInit,$today)){
    echo json_encode(['ok'=>true,'nb'=>0,'message'=>"$kairosInit absent du planning aujourd'hui"]); exit;
}

// Envoyer notification push
$nb=count($kairos);
$titres=array_column($kairos,'txt');
$msg=$nb===1?$titres[0]:"$nb Kairos en attente : ".implode(', ',array_slice($titres,0,2)).($nb>2?'...':'');

// Forcer test avec &force=1
$force=($_GET['force']??'')===1||($_GET['force']??'')==='1';

$notifUrl='https://info.pharmaciedumarais.net/api/notify-planning';
$payload=json_encode([
    'token'=>$TOKEN,
    'title'=>'⚡ Kairos',
    'body'=>$msg,
    'url'=>'https://planning.pharmaciedumarais.net/#mnemosyne',
    'empInit'=>$kairosInit
]);

$ch=curl_init($notifUrl);
curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_POSTFIELDS=>$payload,
    CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_TIMEOUT=>10,
]);
$res=curl_exec($ch);
$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode(['ok'=>$code===200,'nb'=>$nb,'kairos'=>$titres,'notif'=>$res]);
