<?php
// ============================================================
// SEND_PLANNING_PROJET.PHP — Envoi email d'un projet non publié
// ============================================================
ini_set('display_errors',0);
error_reporting(0);
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true) ?? [];
if(($data['token']??'') !== 'pharmacie-lempdes-cron-2026'){
    echo json_encode(['ok'=>false,'error'=>'Accès refusé']); exit;
}

$state      = $data['state'] ?? [];
$projetIdx  = $data['projetIdx'] ?? null;
$projetNom  = $data['projetNom'] ?? 'Projet';
$employes   = $state['employes'] ?? [];
$projets    = $state['projets'] ?? [];
$masque     = $state['masque'] ?? [];
$masqueStart= $state['masqueStart'] ?? '';
$params     = $state['params'] ?? [];
$open       = (int)($params['open'] ?? 9);
$close      = (int)($params['close'] ?? 19);
$nbH        = $close - $open;

if($projetIdx === null || !isset($projets[$projetIdx])){
    echo json_encode(['ok'=>false,'error'=>'Projet introuvable']); exit;
}
$projet     = $projets[$projetIdx];
$calendar   = $projet['calendar'] ?? [];
$blockStart = $projet['blockStart'] ?? $projet['debut'] ?? '';
if(!$blockStart){ echo json_encode(['ok'=>false,'error'=>'Pas de période définie']); exit; }

// Lire config SMTP depuis send_mail.php
function lireSMTP(): array {
    $f = __DIR__ . '/send_mail.php';
    if (!file_exists($f)) return ['host'=>'','port'=>587,'user'=>'','pass'=>''];
    $c = file_get_contents($f);
    preg_match('#\$SMTP_HOST\s*=\s*["\']([^"\']+)["\']#', $c, $mH);
    preg_match('#\$SMTP_PORT\s*=\s*(\d+)#',               $c, $mP);
    preg_match('#\$SMTP_USER\s*=\s*["\']([^"\']+)["\']#', $c, $mU);
    preg_match('#\$SMTP_PASS\s*=\s*["\']([^"\']+)["\']#', $c, $mPw);
    return [
        'host' => $mH[1]  ?? 'mail.infomaniak.com',
        'port' => (int)($mP[1] ?? 587),
        'user' => $mU[1]  ?? '',
        'pass' => $mPw[1] ?? '',
    ];
}

function sc_spp($s,$c){fwrite($s,$c."\r\n");return sr_spp($s);}
function sr_spp($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}

function envoyerHTML_spp(string $to, string $subject, string $html, array $cfg): bool {
    if (!$cfg['pass']) return false;
    $sock = stream_socket_client("tcp://{$cfg['host']}:{$cfg['port']}", $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 15);
    sr_spp($sock); sc_spp($sock,"EHLO localhost"); sc_spp($sock,"STARTTLS");
    stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc_spp($sock,"EHLO localhost"); sc_spp($sock,"AUTH LOGIN");
    sc_spp($sock, base64_encode($cfg['user']));
    $r = sc_spp($sock, base64_encode($cfg['pass']));
    if (strpos($r,'235')===false && strpos($r,'334')===false) { fclose($sock); return false; }
    sc_spp($sock,"MAIL FROM:<{$cfg['user']}>");
    sc_spp($sock,"RCPT TO:<$to>"); sc_spp($sock,"DATA");
    $sub  = '=?UTF-8?B?'.base64_encode($subject).'?=';
    $name = '=?UTF-8?B?'.base64_encode('Pharmacie du Marais').'?=';
    $msg  = "From: {$name} <{$cfg['user']}>\r\nTo: $to\r\nSubject: $sub\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg .= chunk_split(base64_encode($html), 76, "\r\n") . "\r\n.";
    $r2 = sc_spp($sock, $msg); sc_spp($sock,"QUIT"); fclose($sock);
    return strpos($r2,'250') !== false;
}

function tcColor_spp(string $hex): string {
    $hex = ltrim($hex,'#');
    $r=hexdec(substr($hex,0,2));$g=hexdec(substr($hex,2,2));$b=hexdec(substr($hex,4,2));
    return (0.299*$r+0.587*$g+0.114*$b)/255>0.52?'#1c2b24':'#ffffff';
}

function getCellProjet_spp(array $cal, string $ds, int $h, string $init): bool {
    if(!isset($cal[$ds][$h]))return false;
    $row=$cal[$ds][$h];
    if(is_array($row)&&!isset($row[0]))return (bool)($row[$init]??false);
    return false;
}

$JOURS=['Lun','Mar','Mer','Jeu','Ven','Sam'];
$emps=array_values(array_filter($employes,fn($e)=>($e['actif']??true)!==false));

// Construire le tableau HTML
$d1=new DateTime($blockStart);
$d2=clone $d1; $d2->modify('+27 days');
$periode=$d1->format('d/m/Y').' - '.$d2->format('d/m/Y');

// Légende
$legende='';
foreach($emps as $e){
    $tc=tcColor_spp($e['color']??'#ccc');
    $legende.='<span style="background:'.htmlspecialchars($e['color']??'#ccc').';color:'.$tc.';padding:1px 7px;border-radius:3px;font-weight:700;font-size:10px;display:inline-block;margin:1px">'.htmlspecialchars($e['init']).'</span> ';
}

// Tableau planning
$SEM_BG=['#1a4a34','#1a3a5c','#1a4a34','#1a3a5c'];
$tbl='<table style="border-collapse:collapse;font-size:8px;white-space:nowrap">';
for($s=0;$s<4;$s++){
    $bg=$SEM_BG[$s];
    $tbl.='<tr><td style="background:#f0f4f2;padding:1px 4px;font-size:7px;font-weight:700;color:#555"></td>';
    for($j=0;$j<6;$j++){
        $d=new DateTime($blockStart); $d->modify('+'.($s*7+$j).' days');
        $tbl.='<td colspan="'.count($emps).'" style="background:'.$bg.';color:#fff;padding:2px 4px;text-align:center;font-weight:700;font-size:8px;border:1px solid rgba(255,255,255,.2)">'.$JOURS[$j].' '.$d->format('d/m').'</td>';
        if($j<5)$tbl.='<td style="width:2px;background:#ccc"></td>';
    }
    $tbl.='</tr>';
    // Initiales
    $tbl.='<tr><td style="background:#f0f4f2"></td>';
    for($j=0;$j<6;$j++){
        foreach($emps as $e){
            $tc=tcColor_spp($e['color']??'#ccc');
            $tbl.='<td style="background:'.htmlspecialchars($e['color']??'#ccc').';color:'.$tc.';text-align:center;padding:1px;font-weight:700;font-size:7px;border:1px solid rgba(0,0,0,.1)">'.htmlspecialchars($e['init']).'</td>';
        }
        if($j<5)$tbl.='<td style="width:2px;background:#ccc"></td>';
    }
    $tbl.='</tr>';
    // Heures
    for($h=0;$h<$nbH;$h++){
        $rowBg=$h%2===0?'#f9fbfa':'#fff';
        $tbl.='<tr><td style="background:#f0f4f2;padding:1px 4px;font-weight:700;color:#555;font-size:7px;text-align:right;border:1px solid #ddd;white-space:nowrap">'.($open+$h).'h</td>';
        for($j=0;$j<6;$j++){
            $d=new DateTime($blockStart); $d->modify('+'.($s*7+$j).' days');
            $ds=$d->format('Y-m-d');
            foreach($emps as $e){
                $on=getCellProjet_spp($calendar,$ds,$h,$e['init']);
                $cbg=$on?$e['color']:$rowBg;
                $tbl.='<td style="width:12px;height:10px;background:'.$cbg.';border:1px solid #eee"></td>';
            }
            if($j<5)$tbl.='<td style="width:2px;background:#ccc"></td>';
        }
        $tbl.='</tr>';
    }
}
$tbl.='</table>';

$htmlEmail='<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;padding:16px;background:#f4f6f5">
<div style="max-width:900px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
  <div style="background:#e67e22;padding:14px;color:#fff">
    <div style="font-size:14px;font-weight:700">Pharmacie du Marais - Planning previsionnel</div>
    <div style="font-size:11px;opacity:.85">'.htmlspecialchars($projetNom).' - '.$periode.' - NON PUBLIE</div>
  </div>
  <div style="padding:12px">
    <div style="margin-bottom:8px">'.$legende.'</div>
    '.$tbl.'
  </div>
</div>
</body></html>';

$smtpCfg=lireSMTP();
if(!$smtpCfg['pass']){ echo json_encode(['ok'=>false,'error'=>'SMTP non configure']); exit; }

$nb=0;
foreach($emps as $emp){
    if(empty($emp['email']))continue;
    $ok=envoyerHTML_spp($emp['email'],'Planning previsionnel - '.htmlspecialchars($projetNom).' ('.$periode.')',$htmlEmail,$smtpCfg);
    if($ok)$nb++;
    usleep(300000);
}
echo json_encode(['ok'=>true,'nb'=>$nb]);
