<?php
// ============================================================
// CRON_MENSUEL.PHP — Planning du mois suivant
// Se déclenche le dernier jour du mois - 7
// Envoie le planning complet du mois suivant à toute l'équipe
// ============================================================
ini_set('html_errors', 0);
ini_set('display_errors', 0);
error_reporting(0);
set_time_limit(300);

$TOKEN = 'pharmacie-lempdes-cron-2026';
if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403); echo 'Accès refusé'; exit;
}

// Déclenchement fixe le 24 de chaque mois via CRON Infomaniak

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

// ── Mois suivant ──
$moisSuivant  = new DateTime('first day of next month');
$dernierJour  = new DateTime('last day of next month');
$moisNoms = ['1'=>'Janvier','2'=>'Février','3'=>'Mars','4'=>'Avril','5'=>'Mai','6'=>'Juin',
             '7'=>'Juillet','8'=>'Août','9'=>'Septembre','10'=>'Octobre','11'=>'Novembre','12'=>'Décembre'];
$moisLabel = ($moisNoms[(int)$moisSuivant->format('n')] ?? '') . ' ' . $moisSuivant->format('Y');

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


function tcColor(string $hex): string {
    $hex = ltrim($hex,'#');
    $r=hexdec(substr($hex,0,2)); $g=hexdec(substr($hex,2,2)); $b=hexdec(substr($hex,4,2));
    return (0.299*$r+0.587*$g+0.114*$b)/255 > 0.52 ? '#1c2b24' : '#ffffff';
}

// ── Légende ──
$legende = '';
foreach ($employes as $emp) {
    $tc = tcColor($emp['color']);
    $legende .= '<span style="background:'.$emp['color'].';color:'.$tc.';padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;display:inline-block;margin:2px">'.$init.'</span>';
}

$jours_fr = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
$moisNomsC = ['1'=>'jan','2'=>'fév','3'=>'mar','4'=>'avr','5'=>'mai','6'=>'juin',
              '7'=>'juil','8'=>'août','9'=>'sep','10'=>'oct','11'=>'nov','12'=>'déc'];

// Couleurs des semaines qui se répètent
$semColors = ['#1a6b4a','#1a3a5c','#3d2b1a','#3a1a1a','#1a6b4a','#1a3a5c'];
$semIdx = 0;

// ── Générer les tableaux jour par jour ──
$tableauxJours = '';
$cur = clone $moisSuivant;

// Reculer au lundi de la semaine du 1er du mois
$dow = (int)$cur->format('N');
if ($dow > 1) $cur->modify('-'.($dow-1).' days');

$semCouleurIdx = 0;
$derniereLundi = null;

while ($cur <= $dernierJour) {
    $ds  = $cur->format('Y-m-d');
    $dow = (int)$cur->format('N'); // 1=lun, 7=dim

    // Nouveau lundi = nouvelle semaine
    if ($dow === 1) {
        $derniereLundi = clone $cur;
        $semCouleurIdx = ($semCouleurIdx + 1) % count($semColors);
    }

    // Ignorer dimanches et jours hors mois
    if ($dow === 7 || $cur < $moisSuivant) {
        $cur->modify('+1 day');
        continue;
    }

    $jourIdx  = $dow - 1; // 0=lun
    $bg2      = $semColors[$semCouleurIdx % count($semColors)];
    $mn       = (int)$cur->format('n');
    $dayLabel = $jours_fr[$jourIdx].' '.$cur->format('d').' '.($moisNomsC[$mn] ?? '').' '.$cur->format('Y');

    // En-tête initiales
    $theads = '<th width="32" bgcolor="#f0f4f2"><font color="#555555" size="1">H</font></th>';
    foreach ($employes as $emp) {
        $tc2  = tcColor($emp['color']);
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

    $cur->modify('+1 day');
}

// ── HTML email ──
$htmlBody = '<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f4f6f5;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#1a6b4a;border-radius:10px 10px 0 0;padding:14px 16px;color:#fff;margin-bottom:12px">
    <div style="font-size:15px;font-weight:700">&#9874; Pharmacie du Marais</div>
    <div style="font-size:12px;opacity:.8">Planning — '.$moisLabel.'</div>
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
    Pharmacie du Marais &middot; Planning '.$moisLabel.'
  </div>
</div>
</body></html>';

// ── Générer le HTML planning complet (pièce jointe) ──
$planningHtml = buildPlanningHTML($employes, $masque, $masqueStart, $calendar,
                                   $moisLabel, $moisSuivant, $dernierJour, $open, $close);

// ── Corps email simple ──
$htmlBodyEmail = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;padding:20px">'
    . '<h2 style="color:#1a6b4a">Pharmacie du Marais</h2>'
    . '<p>Bonjour,</p>'
    . '<p>Veuillez trouver en piece jointe le planning de <strong>' . $moisLabel . '</strong>.</p>'
    . '<p>Ouvrez le fichier HTML dans votre navigateur pour le consulter ou imprimer en PDF.</p>'
    . '<p><a href="' . SITE_URL . '">Voir le planning en ligne</a></p>'
    . '</body></html>';

// ── Envoyer à chaque employé avec PJ ──
$envoyes = 0; $erreurs = [];
$pjName = 'planning-'.$moisSuivant->format('Y-m').'.html';
foreach ($employes as $emp) {
    if (empty($emp['email'])) continue;
    if (($emp['actif'] ?? true) === false) continue;
    $ok = envoyerAvecPJ($emp['email'], 'Planning '.$moisLabel.' — Pharmacie du Marais',
                        $htmlBodyEmail, $planningHtml, $pjName, $smtpCfg);
    if ($ok) $envoyes++;
    else $erreurs[] = $emp['init'];
    usleep(500000);
}

echo "Planning {$moisLabel} envoyé à {$envoyes} employé(s)\n";
if (!empty($erreurs)) echo "Erreurs : ".implode(', ', $erreurs)."\n";

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


function buildPlanningHTML(array $employes, array $masque, string $masqueStart, array $calendar,
                            string $moisLabel, DateTime $moisDebut, DateTime $moisFin,
                            int $open, int $close): string {
    $nbH = $close - $open;
    $JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    $SEM_BG = ['#1a4a34','#1a3a5c'];

    // Légende
    $legende = '';
    foreach ($employes as $emp) {
        $tc = tcColor($emp['color']);
        $legende .= '<span style="background:'.$emp['color'].';color:'.$tc.';padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;display:inline-block;margin:2px">'.$emp['init'].'</span>';
    }

    // Trouver le lundi de la première semaine du mois
    $cur = clone $moisDebut;
    $dow = (int)$cur->format('N');
    if ($dow > 1) $cur->modify('-'.($dow-1).' days');

    $semaines = '';
    $semIdx = 0;

    while ($cur <= $moisFin) {
        $lundi = clone $cur;
        $samedi = (clone $lundi)->modify('+5 days');
        $bg = $SEM_BG[$semIdx % 2];

        // En-tête semaine
        $thJours = '<th style="background:#f0f4f2;padding:3px 6px;font-size:10px;color:#555;min-width:28px;border:1px solid #ddd">H</th>';
        for ($j = 0; $j < 6; $j++) {
            $d = (clone $lundi)->modify("+$j days");
            $ds = $d->format('Y-m-d');
            // Hors mois = grisé
            $inMois = ($d >= $moisDebut && $d <= $moisFin);
            $colBg = $inMois ? $bg : '#888';
            $thJours .= '<th colspan="'.count($employes).'" style="background:'.$colBg.';color:#fff;padding:3px 4px;text-align:center;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.2)">'
                .$JOURS[$j].' '.$d->format('d/m').'</th>';
            if ($j < 5) $thJours .= '<th style="width:2px;background:'.$colBg.'"></th>';
        }

        // En-tête initiales
        $thInits = '<td style="background:#f0f4f2;border:1px solid #ddd"></td>';
        for ($j = 0; $j < 6; $j++) {
            $d = (clone $lundi)->modify("+$j days");
            $inMois = ($d >= $moisDebut && $d <= $moisFin);
            foreach ($employes as $emp) {
                $tc = tcColor($emp['color']);
                $bg2 = $inMois ? $emp['color'] : '#ccc';
                $thInits .= '<td style="background:'.$bg2.';color:'.$tc.';text-align:center;padding:1px;font-weight:700;font-size:9px;border:1px solid rgba(0,0,0,.1)">'.$emp['init'].'</td>';
            }
            if ($j < 5) $thInits .= '<td style="width:2px;background:#ccc"></td>';
        }

        // Lignes heures
        $rows = '';
        for ($h = 0; $h < $nbH; $h++) {
            $rowBg = ($h%2==0) ? '#f9fbfa' : '#fff';
            $rows .= '<tr><td style="background:#f0f4f2;padding:1px 4px;font-weight:700;color:#555;font-size:9px;text-align:right;border:1px solid #ddd;white-space:nowrap">'.($open+$h).'h</td>';
            for ($j = 0; $j < 6; $j++) {
                $d = (clone $lundi)->modify("+$j days");
                $ds = $d->format('Y-m-d');
                $inMois = ($d >= $moisDebut && $d <= $moisFin);
                foreach ($employes as $emp) {
                    if (!$inMois) {
                        $rows .= '<td style="width:14px;height:12px;background:#eee;border:1px solid #e0e0e0"></td>';
                    } else {
                        $on = getCell($calendar, $masque, $masqueStart, $ds, $h, $emp['init']);
                        $cellBg = $on ? $emp['color'] : $rowBg;
                        $rows .= '<td style="width:14px;height:12px;background:'.$cellBg.';border:1px solid #eee"></td>';
                    }
                }
                if ($j < 5) $rows .= '<td style="width:2px;background:#ccc"></td>';
            }
            $rows .= '</tr>';
        }

        $semLabel = $lundi->format('d/m').' → '.$samedi->format('d/m');
        $semaines .= '
        <div style="margin-bottom:16px">
          <div style="background:'.$bg.';color:#fff;padding:5px 8px;font-weight:700;font-size:11px;border-radius:4px 4px 0 0">
            Semaine du '.$semLabel.'
          </div>
          <div style="overflow-x:auto">
          <table style="border-collapse:collapse;font-size:9px;white-space:nowrap">
            <thead>
              <tr>'.$thJours.'</tr>
              <tr>'.$thInits.'</tr>
            </thead>
            <tbody>'.$rows.'</tbody>
          </table>
          </div>
        </div>';

        $cur->modify('+7 days');
        $semIdx++;
    }

    return '<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planning '.$moisLabel.' — Pharmacie du Marais</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#f4f6f5}
.wrap{max-width:1200px;margin:0 auto;background:#fff;border-radius:10px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h1{color:#1a6b4a;font-size:1.2rem;margin-bottom:4px}
.sub{color:#6b7280;font-size:.8rem;margin-bottom:16px}
@media print{body{background:#fff}.wrap{box-shadow:none;padding:0}@page{size:A4 landscape;margin:1cm}}
</style>
</head>
<body>
<div class="wrap">
  <h1>⚕ Pharmacie du Marais</h1>
  <div class="sub">Planning — '.$moisLabel.' · Imprimez ce document (Ctrl+P) pour obtenir un PDF</div>
  <div style="margin-bottom:12px">'.$legende.'</div>
  '.$semaines.'
  <div style="margin-top:12px;font-size:.7rem;color:#9ca3af;text-align:center">
    Généré le '.date('d/m/Y à H:i').' · Pharmacie du Marais
  </div>
</div>
</body></html>';
}

function envoyerAvecPJ(string $to, string $subject, string $htmlBody, string $pjHtml, string $pjName, array $cfg): bool {
    if (!$cfg['pass']) return false;
    $sock = stream_socket_client("tcp://{$cfg['host']}:{$cfg['port']}", $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 30);
    sr($sock); sc($sock,"EHLO localhost"); sc($sock,"STARTTLS");
    stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc($sock,"EHLO localhost"); sc($sock,"AUTH LOGIN");
    sc($sock, base64_encode($cfg['user']));
    $r = sc($sock, base64_encode($cfg['pass']));
    if (strpos($r,'235')===false && strpos($r,'334')===false) { fclose($sock); return false; }
    sc($sock,"MAIL FROM:<{$cfg['user']}>");
    sc($sock,"RCPT TO:<$to>"); sc($sock,"DATA");
    $sub      = '=?UTF-8?B?'.base64_encode($subject).'?=';
    $name     = '=?UTF-8?B?'.base64_encode('Pharmacie du Marais').'?=';
    $boundary = 'BOUND_'.md5(uniqid());
    $msg  = "From: {$name} <{$cfg['user']}>\r\nTo: $to\r\nSubject: $sub\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$boundary\"\r\n\r\n";
    $msg .= "--$boundary\r\n";
    $msg .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $msg .= chunk_split(base64_encode($htmlBody), 76, "\r\n");
    $msg .= "--$boundary\r\n";
    $msg .= "Content-Type: text/html; charset=UTF-8; name=\"$pjName\"\r\n";
    $msg .= "Content-Transfer-Encoding: base64\r\n";
    $msg .= "Content-Disposition: attachment; filename=\"$pjName\"\r\n\r\n";
    $msg .= chunk_split(base64_encode($pjHtml), 76, "\r\n");
    $msg .= "--$boundary--\r\n.";
    $r2 = sc($sock, $msg); sc($sock,"QUIT"); fclose($sock);
    return strpos($r2,'250') !== false;
}
function sc($s,$c){fwrite($s,$c."\r\n");return sr($s);}
function sr($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
