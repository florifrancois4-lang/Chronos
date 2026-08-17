<?php
// ============================================================
// CRON_ALERTE.PHP — Alertes veille à 18h
// Si un employé a plus d'heures que le masque demain
// ============================================================
set_time_limit(120);

$TOKEN = 'pharmacie-lempdes-cron-2026';
if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403); echo 'Accès refusé'; exit;
}

define('DATA_FILE', __DIR__ . '/planning_data.json');
define('SITE_URL',  'https://planning.pharmaciedumarais.net');

$smtpCfg = lireSMTP();

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

if (!$masque || !$masqueStart) { echo "Pas de masque\n"; exit; }

// ── Demain ──
$demain = new DateTime('tomorrow');
$jourIdx = (int)$demain->format('N') - 1; // 0=lun, 6=dim
if ($jourIdx > 5) { echo "Dimanche, pas d'alerte\n"; exit; }
$ds = $demain->format('Y-m-d');
$moisNoms = ['1'=>'janvier','2'=>'février','3'=>'mars','4'=>'avril','5'=>'mai','6'=>'juin',
             '7'=>'juillet','8'=>'août','9'=>'septembre','10'=>'octobre','11'=>'novembre','12'=>'décembre'];
$jours_fr = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
$demainLabel = $jours_fr[$jourIdx].' '.$demain->format('d').' '.($moisNoms[(int)$demain->format('n')]).' '.$demain->format('Y');

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



// ── Analyser chaque employé ──
$alertes = [];
foreach ($employes as $ei => $emp) {
    if (($emp['actif'] ?? true) === false) continue;
    $init = $emp['init'];
    $hMasque = 0; $hCal = 0;
    for ($h = 0; $h < $nbH; $h++) {
        if (getMasqueCell($masque, $masqueStart, $ds, $h, $init)) $hMasque++;
        if (getCell($calendar, $masque, $masqueStart, $ds, $h, $init)) $hCal++;
    }
    // Alerte uniquement si heures en plus
    if ($hCal <= $hMasque || $hCal === 0) continue;

    // Calculer les plages horaires
    $segs=[]; $inBlock=false; $start=null;
    for ($h=0;$h<$nbH;$h++) {
        $on=getCell($calendar,$masque,$masqueStart,$ds,$h,$init);
        if ($on&&!$inBlock){$inBlock=true;$start=$open+$h;}
        if (!$on&&$inBlock){$segs[]="{$start}h–".($open+$h)."h";$inBlock=false;}
    }
    if ($inBlock) $segs[]="{$start}h–".($open+$nbH)."h";

    $alertes[] = [
        'emp'     => $emp,
        'hMasque' => $hMasque,
        'hCal'    => $hCal,
        'diff'    => $hCal - $hMasque,
        'segs'    => implode(', ', $segs),
    ];
}

if (empty($alertes)) { echo "Aucune alerte pour demain ({$ds})\n"; exit; }

// ── Envoyer email à chaque employé concerné ──
$envoyes = 0;
foreach ($alertes as $a) {
    $emp = $a['emp'];
    echo "Alerte {$emp['init']} : {$a['hCal']}h (masque: {$a['hMasque']}h, +{$a['diff']}h)\n";
    if (empty($emp['email'])) { echo "  → Pas d'email\n"; continue; }

    $subject = "⚠ Planning modifié — {$demainLabel}";
    $body = "Bonjour {$emp['nom']},\n\n";
    $body .= "Votre planning de demain ({$demainLabel}) a été modifié.\n\n";
    $body .= "Horaires prévus : {$a['segs']}\n";
    $body .= "Heures travaillées : {$a['hCal']}h (au lieu de {$a['hMasque']}h habituellement)\n";
    $body .= "Heures supplémentaires : +{$a['diff']}h\n\n";
    $body .= "Consultez le planning complet : " . SITE_URL . "\n\nCordialement,\nPharmacie du Marais";

    $ok = envoyerTexte($emp['email'], $subject, $body, $smtpCfg);
    echo "  → Email : " . ($ok ? "✅ OK" : "❌ Échec") . "\n";
    if ($ok) $envoyes++;
}

echo "Total alertes envoyées : {$envoyes}\n";

// ── Envoyer notifications push ──
$pushFile = __DIR__ . '/push_send.php';
if (file_exists($pushFile)) {
    require_once $pushFile;
    foreach ($alertes as $a) {
        $emp = $a['emp'];
        $init = $emp['init'];
        $payload = [
            'title' => 'Planning modifié — demain',
            'body'  => ($emp['nom'] ?? $init) . ' : ' . $a['hCal'] . 'h prévues (masque : ' . $a['hMasque'] . 'h)',
            'tag'   => 'alerte-' . $init,
            'url'   => '/'
        ];
        $results = sendToEmployee($init, $payload);
        $ok = !empty($results) && ($results[0]['code'] ?? 0) >= 200 && ($results[0]['code'] ?? 0) < 300;
        $code = $results[0]['code'] ?? '?';
        $err  = $results[0]['error'] ?? 'no result';
        $resp = substr($results[0]['response'] ?? '', 0, 100);
        echo "  → Push {$init} : " . ($ok ? "✅ OK" : "❌ Échec (code $code, err: $err, resp: $resp)") . "\n";
    }
} else {
    echo "push_send.php introuvable — pas de notification push\n";
}

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

function envoyerTexte(string $to, string $subject, string $body, array $cfg): bool {
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
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg .= chunk_split(base64_encode($body)) . "\r\n.";
    $r2 = sc($sock, $msg); sc($sock,"QUIT"); fclose($sock);
    return strpos($r2,'250') !== false;
}
function sc($s,$c){fwrite($s,$c."\r\n");return sr($s);}
function sr($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
