<?php
// ============================================================
// CRON_DIMANCHE.PHP — Envoi planning semaine suivante
// Chaque dimanche à 18h via CRON Infomaniak
// ============================================================
ini_set('html_errors', 0);
ini_set('display_errors', 0);
error_reporting(0);
set_time_limit(120);

$TOKEN = 'pharmacie-lempdes-cron-2026';
if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403); echo 'Accès refusé'; exit;
}

define('DATA_FILE', __DIR__ . '/planning_data.json');
define('SITE_URL',  'https://planning.pharmaciedumarais.net');

// ── Lire config SMTP depuis send_mail.php ──
$smtpCfg = lireSMTP();

// ── Charger les données ──
if (!file_exists(DATA_FILE)) { echo "Pas de données\n"; exit; }
$state = json_decode(file_get_contents(DATA_FILE), true);
if (!$state) { echo "JSON invalide\n"; exit; }

$employes    = $state['employes'] ?? [];
$masque      = $state['masque'] ?? null;
$masqueStart = $state['masqueStart'] ?? null;
$calendar    = $state['calendar'] ?? [];
$open        = $state['params']['open'] ?? 9;
$close       = $state['params']['close'] ?? 19;
$nbH         = $close - $open;

// ── Semaine prochaine : lundi suivant ──
$lundi  = new DateTime('next monday');
$samedi = (clone $lundi)->modify('+5 days');
$moisNoms = ['1'=>'jan','2'=>'fév','3'=>'mar','4'=>'avr','5'=>'mai','6'=>'juin',
             '7'=>'juil','8'=>'août','9'=>'sep','10'=>'oct','11'=>'nov','12'=>'déc'];
$semLabel = 'Semaine du ' . $lundi->format('d') . ' ' . ($moisNoms[(int)$lundi->format('n')]) .
            ' au ' . $samedi->format('d') . ' ' . ($moisNoms[(int)$samedi->format('n')]) .
            ' ' . $samedi->format('Y');

// ── Fonctions calendrier ──
function getMasqueSemIdx(string $ds, string $ms): int {
    $diff = (int)round((strtotime($ds) - strtotime($ms)) / 86400);
    if ($diff < 0) $diff = (($diff % 14) + 14) % 14;
    return (int)floor($diff / 7) % 2;
}
function getMasqueJourIdx(string $ds): int {
    return (int)(new DateTime($ds))->format('N') - 1;
}
function getMasqueCell(array $masque, string $ms, string $ds, int $h, string $init): bool {
    $si = getMasqueSemIdx($ds, $ms);
    $ji = getMasqueJourIdx($ds);
    if ($ji > 5) return false;
    $row = $masque[$si]['cells'][$ji][$h] ?? null;
    if ($row === null) return false;
    // Nouveau format par initiales
    if (is_array($row) && array_keys($row) !== range(0, count($row)-1)) {
        return (bool)($row[$init] ?? false);
    }
    return false;
}
function getCell(array $cal, array $masque, string $ms, string $ds, int $h, string $init, array $employes = []): bool {
    if (isset($cal[$ds]) && isset($cal[$ds][$h])) {
        $row = $cal[$ds][$h];
        if (is_array($row)) {
            // Nouveau format par initiales
            if (!isset($row[0])) {
                // Si le jour a un override, et que la clé est absente → absent (false)
                // Sauf si aucune clé du tout (row vide) → fallback masque
                if (!empty($row)) {
                    return array_key_exists($init, $row) ? (bool)$row[$init] : false;
                }
                return getMasqueCell($masque, $ms, $ds, $h, $init);
            }
            // Ancien format par index
            foreach ($employes as $ei => $emp) {
                if ($emp['init'] === $init) {
                    return array_key_exists($ei, $row) ? (bool)$row[$ei] : false;
                }
            }
            return false;
        }
    }
    return getMasqueCell($masque, $ms, $ds, $h, $init);
}


// ── Couleurs et contraste ──
$colors = array_column($employes, 'color', 'init');
function tc(string $hex): string {
    $hex = ltrim($hex,'#');
    $r=hexdec(substr($hex,0,2)); $g=hexdec(substr($hex,2,2)); $b=hexdec(substr($hex,4,2));
    return (0.299*$r+0.587*$g+0.114*$b)/255 > 0.52 ? '#1c2b24' : '#ffffff';
}

$jours_fr = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
$joursBg  = ['#1a6b4a','#1a3a5c','#3d2b1a','#3a1a1a','#1a6b4a','#1a3a5c'];

// ── Générer HTML — un tableau par jour ──
function tcColor(string $hex): string {
    $hex = ltrim($hex,'#');
    $r=hexdec(substr($hex,0,2)); $g=hexdec(substr($hex,2,2)); $b=hexdec(substr($hex,4,2));
    return (0.299*$r+0.587*$g+0.114*$b)/255 > 0.52 ? '#1c2b24' : '#ffffff';
}

$jours_fr  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
$joursBg   = ['#1a6b4a','#1a3a5c','#3d2b1a','#3a1a1a','#1a6b4a','#1a3a5c'];
$moisNoms2 = ['1'=>'janvier','2'=>'février','3'=>'mars','4'=>'avril','5'=>'mai','6'=>'juin',
              '7'=>'juillet','8'=>'août','9'=>'septembre','10'=>'octobre','11'=>'novembre','12'=>'décembre'];

// Légende
$legende = '';
foreach ($employes as $emp) {
    $tc2 = tcColor($emp['color']);
    $legende .= '<span style="background:'.$emp['color'].';color:'.$tc2.';padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;display:inline-block;margin:2px">'.$init.'</span>';
}

// 6 tableaux — un par jour
$tableauxJours = '';
for ($j = 0; $j < 6; $j++) {
    $d   = (clone $lundi)->modify("+$j days");
    $ds  = $d->format('Y-m-d');
    $dn  = (int)$d->format('n');
    $dayLabel = $jours_fr[$j].' '.$d->format('d').' '.($moisNoms2[$dn] ?? '').' '.$d->format('Y');
    $bg2 = $joursBg[$j];

    // En-tête initiales
    $theads = '<th width="32" bgcolor="#f0f4f2"><font color="#555555" size="1">H</font></th>';
    foreach ($employes as $emp) {
        $tc2 = tcColor($emp['color']);
        $init = htmlspecialchars($init);
        $col  = $emp['color'];
        $theads .= '<th width="18" bgcolor="'.$col.'"><font color="'.$tc2.'" size="1"><b>'.$init.'</b></font></th>';
    }

    // Lignes heures
    $lignes = '';
    for ($h = 0; $h < $nbH; $h++) {
        $bg  = ($h%2==0) ? '#f9fbfa' : '#ffffff';
        $hh  = $open + $h;
        $row = '<tr><td width="32" bgcolor="#f0f4f2"><font color="#555555" size="1"><b>'.$hh.'h</b></font></td>';
        foreach ($employes as $ei => $emp) {
            $on     = getCell($calendar, $masque, $masqueStart, $ds, $h, $emp['init']);
            $cellBg = $on ? $emp['color'] : $bg;
            $row   .= '<td width="18" height="14" bgcolor="'.$cellBg.'"></td>';
        }
        $row    .= '</tr>';
        $lignes .= $row;
    }

    $tableauxJours .= '
    <div style="background:#fff;border-radius:8px;margin-bottom:10px;overflow:hidden;border:1px solid #d1e3da">
      <div style="background:'.$bg2.';padding:8px 12px;color:#fff;font-weight:700;font-size:13px">
        &#128197; '.$dayLabel.'
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:11px">
        <thead><tr>'.$theads.'</tr></thead>
        <tbody>'.$lignes.'</tbody>
      </table>
    </div>';
}

$htmlBody = '<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f4f6f5;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#1a6b4a;border-radius:10px 10px 0 0;padding:14px 16px;color:#fff;margin-bottom:12px">
    <div style="font-size:15px;font-weight:700">&#9874; Pharmacie du Marais</div>
    <div style="font-size:12px;opacity:.8">Planning — '.$semLabel.'</div>
  </div>
  <div style="background:#fff;border-radius:8px;padding:10px 12px;margin-bottom:12px;border:1px solid #d1e3da">
    <div style="font-size:11px;font-weight:700;color:#1a6b4a;margin-bottom:6px">&#201;quipe</div>
    <div>'.$legende.'</div>
  </div>
  '.$tableauxJours.'
  <div style="background:#e8f4ef;border-radius:8px;padding:12px;text-align:center;margin-top:4px">
    <a href="'.SITE_URL.'" style="color:#1a6b4a;font-weight:700;font-size:13px;text-decoration:none">
      &#128197; Voir le planning complet en ligne &rarr;
    </a>
  </div>
  <div style="text-align:center;color:#9ca3af;font-size:11px;padding:10px">
    Pharmacie du Marais &middot; Envoi automatique du dimanche
  </div>
</div>
</body></html>';



// ── Envoyer à chaque employé ayant un email ──
$envoyes = 0; $erreurs = [];
foreach ($employes as $emp) {
    if (empty($emp['email'])) continue;
    $ok = envoyerHTML($emp['email'], "Planning — {$semLabel}", $htmlBody, $smtpCfg);
    if ($ok) $envoyes++;
    else $erreurs[] = $init;
}

echo "Emails envoyés : {$envoyes}\n";
if (!empty($erreurs)) echo "Erreurs : " . implode(', ', $erreurs) . "\n";

// ── Config SMTP ──
function lireSMTP(): array {
    $f = __DIR__ . '/send_mail.php';
    if (!file_exists($f)) return [];
    $c = file_get_contents($f);
    preg_match("/\\\$SMTP_HOST\s*=\s*'([^']+)'/", $c, $mH);
    preg_match("/\\\$SMTP_PORT\s*=\s*(\d+)/",     $c, $mP);
    preg_match("/\\\$SMTP_USER\s*=\s*'([^']+)'/", $c, $mU);
    preg_match("/\\\$SMTP_PASS\s*=\s*'([^']+)'/", $c, $mPw);
    return [
        'host' => $mH[1]  ?? 'mail.infomaniak.com',
        'port' => (int)($mP[1] ?? 587),
        'user' => $mU[1]  ?? '',
        'pass' => $mPw[1] ?? '',
    ];
}

function envoyerHTML(string $to, string $subject, string $html, array $cfg): bool {
    if (!$cfg['pass']) return false;
    $sock = stream_socket_client("tcp://{$cfg['host']}:{$cfg['port']}", $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 15);
    sr($sock); sc($sock,"EHLO localhost"); sc($sock,"STARTTLS");
    stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc($sock,"EHLO localhost"); sc($sock,"AUTH LOGIN");
    sc($sock, base64_encode($cfg['user']));
    $r = sc($sock, base64_encode($cfg['pass']));
    if (strpos($r,'235')===false && strpos($r,'334')===false) { fclose($sock); return false; }
    sc($sock,"MAIL FROM:<{$cfg['user']}>");
    sc($sock,"RCPT TO:<$to>"); sc($sock,"DATA");
    $sub  = '=?UTF-8?B?'.base64_encode($subject).'?=';
    $name = '=?UTF-8?B?'.base64_encode('Pharmacie du Marais').'?=';
    $msg  = "From: {$name} <{$cfg['user']}>\r\nTo: $to\r\nSubject: $sub\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg .= chunk_split(base64_encode($html), 76, "\r\n") . "\r\n.";
    $r2 = sc($sock, $msg); sc($sock,"QUIT"); fclose($sock);
    return strpos($r2,'250') !== false;
}
function sc($s,$c){fwrite($s,$c."\r\n");return sr($s);}
function sr($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
