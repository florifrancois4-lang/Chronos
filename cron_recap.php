<?php
// ============================================================
// CRON_RECAP.PHP — Récapitulatif mensuel des heures
// Envoi automatique le 24 de chaque mois
// Accessible aussi manuellement depuis l'appli
// ============================================================


define('DATA_FILE', __DIR__ . '/planning_data.json');
define('FROM_EMAIL', 'votre-email@pharmaciedumarais.net');
define('FROM_NAME',  'Pharmacie du Marais');
define('TITULAIRE',  'votre-email@pharmaciedumarais.net'); // ← email du titulaire
define('SITE_URL',   'https://planning.pharmaciedumarais.net');
define('TOKEN',      'pharmacie-lempdes-cron-2026');

// Sécurité token
if (php_sapi_name() !== 'cli' && ($_GET['token'] ?? '') !== TOKEN) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($auth !== 'Bearer ' . TOKEN) {
        http_response_code(403); echo json_encode(['ok'=>false,'error'=>'Accès refusé']); exit;
    }
}

// Lire justifications depuis POST
$postData = json_decode(file_get_contents('php://input'), true) ?? [];
$justifications = $postData['justifications'] ?? [];

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if (!file_exists(DATA_FILE)) { echo json_encode(['ok'=>false,'error'=>'Pas de données']); exit; }
$state = json_decode(file_get_contents(DATA_FILE), true);
if (!$state) { echo json_encode(['ok'=>false,'error'=>'Données invalides']); exit; }

$employes    = $state['employes'] ?? [];
$masque      = $state['masque'] ?? null;
$masqueStart = $state['masqueStart'] ?? null;
$calendar    = $state['calendar'] ?? [];
$open        = $state['params']['open'] ?? 9;
$close       = $state['params']['close'] ?? 19;
$nbH         = $close - $open;

// Période : premier → dernier jour du mois en cours
$moisParam = $_GET['mois'] ?? date('Y-m'); // ex: 2026-06
[$annee, $mois] = explode('-', $moisParam);
$premierJour = new DateTime("$annee-$mois-01");
$dernierJour = new DateTime("$annee-$mois-" . date('t', mktime(0,0,0,$mois,1,$annee)));
$moisNoms = ['01'=>'Janvier','02'=>'Février','03'=>'Mars','04'=>'Avril','05'=>'Mai','06'=>'Juin',
             '07'=>'Juillet','08'=>'Août','09'=>'Septembre','10'=>'Octobre','11'=>'Novembre','12'=>'Décembre'];
$moisLabel = ($moisNoms[$mois] ?? $mois) . ' ' . $annee;

// ── Fonctions utilitaires ──
function dateToStr(DateTime $d): string { return $d->format('Y-m-d'); }

function getMasqueCell(array $masque, string $ms, string $ds, int $h, string $init): bool {
    $si = getMasqueSemaineIndex($ds, $ms);
    $ji = getMasqueJourIndex($ds);
    if ($ji > 5) return false;
    $row = $masque[$si]['cells'][$ji][$h] ?? null;
    if ($row === null) return false;
    if (is_array($row) && array_keys($row) !== range(0, count($row)-1))
        return (bool)($row[$init] ?? false);
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

function getMasqueSemaineIndex(string $ds, string $masqueStart): int {
    $ms = new DateTime($masqueStart);
    $d  = new DateTime($ds);
    $diff = (int)round(($d->getTimestamp() - $ms->getTimestamp()) / 86400);
    if ($diff < 0) $diff = (($diff % 14) + 14) % 14;
    return (int)floor($diff / 7) % 2;
}

function getMasqueJourIndex(string $ds): int {
    $dow = (int)(new DateTime($ds))->format('N'); // 1=lun, 7=dim
    return $dow - 1; // 0=lun, 5=sam
}





function getHeuresContrat(array $emp, string $lundoStr, string $masqueStart): float {
    $rot = $emp['rotation'] ?? 2;
    $hps = $emp['heuresParSemaine'] ?? [$emp['heures'] ?? 35];
    if (!$masqueStart || count($hps) < 2) return $hps[0] ?? 35;
    $ms = new DateTime($masqueStart);
    $d  = new DateTime($lundoStr);
    $diffDays = (int)round(($d->getTimestamp() - $ms->getTimestamp()) / 86400);
    // Gérer les semaines avant masqueStart par modulo positif
    $semIdx = (int)floor($diffDays / 7);
    $semIdx = (($semIdx % $rot) + $rot) % $rot;
    return $hps[$semIdx] ?? $hps[0] ?? 35;
}

// ── Collecter les semaines du mois ──
// Trouver le lundi de la semaine contenant le 1er du mois
$cur = clone $premierJour;
$dow = (int)$cur->format('N');
if ($dow > 1) $cur->modify('-' . ($dow-1) . ' days');

$semaines = [];
while ($cur <= $dernierJour) {
    $semaines[] = clone $cur;
    $cur->modify('+7 days');
}

// ── Calculer les données par employé ──
$jours_fr = ['Lun','Mar','Mer','Jeu','Ven','Sam'];

$dataEmps = [];
foreach ($employes as $ei => $emp) {
    $semData = [];
    $totalHe = 0; $totalHn = 0; $joursAbsence = [];

    foreach ($semaines as $lundi) {
        $lundoStr = dateToStr($lundi);
        $semFin = clone $lundi; $semFin->modify('+5 days');
        $semLabel = $lundi->format('d/m') . ' → ' . $semFin->format('d/m');

        // Vérifier si la semaine est à cheval sur le mois
        $semainePartielle = ($lundi < $premierJour || $semFin > $dernierJour);

        // He et Hn sur les jours du mois uniquement (pour affichage)
        $he = 0; $hnMois = 0; $absJours = [];
        for ($j = 0; $j < 6; $j++) {
            $d = clone $lundi; $d->modify("+$j days");
            $ds = dateToStr($d);
            if ($d < $premierJour || $d > $dernierJour) continue;
            $hJour = 0; $hnJour = 0;
            for ($h = 0; $h < $nbH; $h++) {
                if (getCell($calendar, $masque, $masqueStart, $ds, $h, $emp['init'], $employes)) $hJour++;
                if (getMasqueCell($masque, $masqueStart, $ds, $h, $emp['init'])) $hnJour++;
            }
            $he += $hJour; $hnMois += $hnJour;
            if ($hnJour > 0 && $hJour === 0) $absJours[] = $jours_fr[$j] . ' ' . $d->format('d/m');
        }

        // Si semaine à cheval : lire la semaine COMPLÈTE pour détecter compensation
        $heComplet = $he; $hnComplet = $hnMois;
        $compensation = false;
        $report = false;
        if ($semainePartielle) {
            $heComplet = 0; $hnComplet = 0;
            for ($j = 0; $j < 6; $j++) {
                $d = clone $lundi; $d->modify("+$j days");
                $ds = dateToStr($d);
                for ($h = 0; $h < $nbH; $h++) {
                    if (getCell($calendar, $masque, $masqueStart, $ds, $h, $emp['init'], $employes)) $heComplet++;
                    if (getMasqueCell($masque, $masqueStart, $ds, $h, $emp['init'])) $hnComplet++;
                }
            }
            // Compensation si semaine complète = équilibre
            if ($heComplet === $hnComplet) {
                $compensation = true; // ✅ compensé sur la semaine entière
            }
            // Sinon : écart réel, affiché normalement avec *
        }

        $ecart = $he - $hnMois;

        $semData[] = [
            'label'        => $semLabel,
            'he'           => $he,
            'hn'           => $hnMois,
            'ecart'        => $ecart,
            'absJours'     => $absJours,
            'partielle'    => $semainePartielle,
            'compensation' => $compensation,
            'report'       => $report,
            'heComplet'    => $heComplet,
            'hnComplet'    => $hnComplet,
        ];

        // Pour les semaines à cheval compensées : ne pas comptabiliser du tout
        $totalHe += $he;
        $totalHn += $hnMois;
        if (!empty($absJours)) $joursAbsence = array_merge($joursAbsence, $absJours);
    }

    // ── Post-traitement : neutraliser les semaines liées à une compensation ──
    foreach ($semData as $idx => $sem) {
        if ($sem['compensation'] ?? false) {
            // Retirer He et Hn de cette semaine compensée
            $totalHe -= $sem['he'];
            $totalHn -= $sem['hn'];
            // Chercher la semaine précédente avec écart opposé
            if ($idx > 0) {
                $prev = $semData[$idx - 1];
                $ecartSem = $sem['he'] - $sem['hn'];       // ex: -10
                $ecartPrev = $prev['he'] - $prev['hn'];    // ex: +10
                if ($ecartSem + $ecartPrev === 0 && $ecartPrev !== 0) {
                    // Neutraliser aussi la semaine précédente
                    $totalHe -= $prev['he'];
                    $totalHn -= $prev['hn'];
                    $totalHe += $prev['hn']; // He = Hn pour neutraliser
                    $totalHn += $prev['hn'];
                    $semData[$idx - 1]['neutralise'] = true;
                    $semData[$idx - 1]['ecart'] = 0;
                }
            }
        }
    }

    $dataEmps[] = [
        'emp'         => $emp,
        'semaines'    => $semData,
        'totalHe'     => $totalHe,
        'totalHn'     => $totalHn,
        'totalEcart'  => $totalHe - $totalHn,
        'absences'    => $joursAbsence,
    ];
}

// ── Générer HTML email ──
$colors = array_column($employes, 'color');

$tc = function($hex) {
    $hex = ltrim($hex,'#');
    $r=hexdec(substr($hex,0,2)); $g=hexdec(substr($hex,2,2)); $b=hexdec(substr($hex,4,2));
    return (0.299*$r+0.587*$g+0.114*$b)/255 > 0.52 ? '#1c2b24' : '#ffffff';
};

$nbSem = count($semaines);

ob_start();
?>
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f4f6f5;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:900px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">

  <!-- EN-TÊTE -->
  <div style="background:#1a6b4a;padding:18px 24px;color:#fff">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:1.6rem">⚕</span>
      <div>
        <div style="font-size:1rem;font-weight:700">Pharmacie du Marais</div>
        <div style="font-size:.8rem;opacity:.8">Récapitulatif des heures — <?= $moisLabel ?></div>
      </div>
    </div>
  </div>

  <div style="padding:20px 24px">
    <p style="color:#6b7280;font-size:.84rem;margin-bottom:20px">
      Bonjour,<br>
      Voici le récapitulatif des heures de l'équipe pour le mois de <strong><?= $moisLabel ?></strong>,
      à transmettre à votre comptable pour la préparation des bulletins de salaire.
    </p>

    <!-- TABLEAU RÉCAP -->
    <div style="overflow-x:auto">
    <table style="border-collapse:collapse;width:100%;font-size:.75rem">
      <!-- En-tête -->
      <thead>
        <tr style="background:#1a4a34;color:#fff">
          <th style="padding:8px 10px;text-align:left;border:1px solid #0f3323;min-width:80px">Salarié</th>
          <?php foreach ($semaines as $lundi): ?>
            <?php $sf = clone $lundi; $sf->modify('+5 days'); ?>
            <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323;min-width:90px;font-size:.68rem">
              <?= $lundi->format('d/m') ?> → <?= $sf->format('d/m') ?>
            </th>
          <?php endforeach; ?>
          <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323;background:#0f3323;min-width:80px">Total</th>
          <th style="padding:8px 6px;text-align:center;border:1px solid #0f3323;background:#0f3323;min-width:70px">Écart</th>
          <th style="padding:8px 6px;text-align:left;border:1px solid #0f3323;min-width:100px;font-size:.66rem">Motif</th>
          <th style="padding:8px 6px;text-align:left;border:1px solid #0f3323;min-width:120px;font-size:.66rem">Absences</th>
        </tr>
        <!-- Sous-en-tête He/Hn -->
        <tr style="background:#e8f4ef">
          <td style="padding:4px 10px;border:1px solid #d1e3da;font-size:.68rem;color:#6b7280"></td>
          <?php for($s=0;$s<$nbSem;$s++): ?>
            <td style="padding:4px 6px;text-align:center;border:1px solid #d1e3da">
              <span style="color:#1a6b4a;font-weight:700;font-size:.66rem">He</span>
              <span style="color:#aaa;font-size:.6rem"> / </span>
              <span style="color:#6b7280;font-size:.66rem">Hn</span>
            </td>
          <?php endfor; ?>
          <td style="padding:4px 6px;text-align:center;border:1px solid #d1e3da;font-size:.66rem;color:#6b7280">He / Hn</td>
          <td style="padding:4px 6px;text-align:center;border:1px solid #d1e3da;font-size:.66rem;color:#6b7280">+/-</td>
          <td style="padding:4px 6px;border:1px solid #d1e3da;font-size:.66rem;color:#6b7280">Jours</td>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($dataEmps as $row):
          $emp = $row['emp'];
          $color = $emp['color'] ?? '#888';
          $textColor = $tc($color);
          $ecartTotal = $row['totalEcart'];
          $ecartColor = $ecartTotal > 0 ? '#1e8449' : ($ecartTotal < 0 ? '#c0392b' : '#6b7280');
        ?>
        <tr>
          <!-- Nom employé -->
          <td style="padding:7px 10px;border:1px solid #d1e3da">
            <span style="background:<?= $color ?>;color:<?= $textColor ?>;padding:2px 7px;border-radius:4px;font-weight:700;font-size:.72rem"><?= htmlspecialchars($emp['init'] ?? '') ?></span>
            <span style="font-size:.73rem;color:#374151;margin-left:5px"><?= htmlspecialchars($emp['nom'] ?? $emp['init'] ?? '') ?></span>
          </td>
          <!-- Semaines -->
          <?php foreach ($row['semaines'] as $sem):
            $ec = $sem['ecart'];
            $comp = $sem['compensation'] ?? false;
            $part = $sem['partielle'] ?? false;
            $bg = $comp ? '#e8f4ef' : ($ec > 0 ? '#d5f5e3' : ($ec < 0 ? '#fde8e8' : '#fff'));
            $ecC = $ec > 0 ? '#1e8449' : ($ec < 0 ? '#c0392b' : '#aaa');
            // Récupérer justification
            $justifKey = $moisParam.'|'.$emp['init'].'|'.$sem['label'];
            $motif = $justifications[$justifKey] ?? '—';
          ?>
          <td style="padding:6px;text-align:center;border:1px solid #d1e3da;background:<?= $bg ?>">
            <span style="font-weight:700;color:#1a6b4a;font-size:.74rem"><?= $sem['he'] ?>h</span>
            <span style="color:#aaa;font-size:.62rem"> / </span>
            <span style="color:#6b7280;font-size:.7rem"><?= $sem['hn'] ?>h</span>
            <?php if ($comp): ?>
              <br><span style="font-size:.6rem;color:#1a6b4a;font-weight:700">✅ compensé</span>
            <?php elseif ($sem['neutralise'] ?? false): ?>
              <br><span style="font-size:.6rem;color:#1a6b4a;font-weight:700">↔ neutralisé</span>
            <?php elseif ($ec != 0): ?>
              <br><span style="font-size:.62rem;color:<?= $ecC ?>;font-weight:700"><?= $ec > 0 ? '+' : '' ?><?= $ec ?>h<?= $part ? '*' : '' ?></span>
            <?php endif; ?>
            <?php if (!empty($sem['absJours'])): ?>
              <br><span style="font-size:.6rem;color:#c0392b">⚠ <?= count($sem['absJours']) ?>j abs.</span>
            <?php endif; ?>
          </td>
          <?php endforeach; ?>
          <!-- Total -->
          <td style="padding:6px;text-align:center;border:1px solid #d1e3da;background:#f8f9fa">
            <span style="font-weight:700;color:#1a6b4a;font-size:.76rem"><?= $row['totalHe'] ?>h</span>
            <span style="color:#aaa;font-size:.62rem"> / </span>
            <span style="color:#6b7280;font-size:.72rem"><?= $row['totalHn'] ?>h</span>
          </td>
          <!-- Écart total -->
          <td style="padding:6px;text-align:center;border:1px solid #d1e3da;font-weight:700;color:<?= $ecartColor ?>;font-size:.78rem;background:<?= $ecartTotal > 0 ? '#d5f5e3' : ($ecartTotal < 0 ? '#fde8e8' : '#fff') ?>">
            <?= $ecartTotal > 0 ? '+' : '' ?><?= $ecartTotal ?>h
          </td>
          <!-- Motif global -->
          <?php
            $motifGlobal = '';
            $motifsUniq = [];
            foreach ($row['semaines'] as $s) {
                $k = $moisParam.'|'.$emp['init'].'|'.$s['label'];
                $m = $justifications[$k] ?? '';
                if ($m && $m !== '—') $motifsUniq[$m] = true;
            }
            $motifGlobal = implode(', ', array_keys($motifsUniq)) ?: '—';
          ?>
          <td style="padding:6px 8px;border:1px solid #d1e3da;font-size:.68rem;color:#1a6b4a;font-weight:500">
            <?= htmlspecialchars($motifGlobal) ?>
          </td>
          <!-- Absences -->
          <td style="padding:6px 8px;border:1px solid #d1e3da;font-size:.68rem;color:#c0392b">
            <?= empty($row['absences']) ? '<span style="color:#aaa">—</span>' : implode(', ', $row['absences']) ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
      <!-- TOTAUX -->
      <tfoot>
        <tr style="background:#1a4a34;color:#fff;font-weight:700">
          <td style="padding:7px 10px;border:1px solid #0f3323;font-size:.74rem">TOTAL ÉQUIPE</td>
          <?php
          foreach ($semaines as $si => $lundi):
            $heS=0; $hnS=0;
            foreach ($dataEmps as $row) {
              if(isset($row['semaines'][$si])){
                $heS += $row['semaines'][$si]['he'];
                $hnS += $row['semaines'][$si]['hn'];
              }
            }
            $ecS=$heS-$hnS; $ecSC=$ecS>0?'+':($ecS<0?'-':' ');
          ?>
          <td style="padding:6px;text-align:center;border:1px solid #0f3323;font-size:.72rem">
            <?= $heS ?>h / <?= $hnS ?>h
            <?php if($ecS!=0): ?><br><span style="font-size:.62rem"><?= $ecSC.$ecS ?>h</span><?php endif; ?>
          </td>
          <?php endforeach; ?>
          <?php
          $gTotalHe=array_sum(array_column($dataEmps,'totalHe'));
          $gTotalHn=array_sum(array_column($dataEmps,'totalHn'));
          $gEcart=$gTotalHe-$gTotalHn;
          ?>
          <td style="padding:6px;text-align:center;border:1px solid #0f3323;font-size:.76rem"><?= $gTotalHe ?>h / <?= $gTotalHn ?>h</td>
          <td style="padding:6px;text-align:center;border:1px solid #0f3323;font-size:.78rem"><?= $gEcart>=0?'+':'' ?><?= $gEcart ?>h</td>
          <td style="padding:6px;border:1px solid #0f3323;font-size:.68rem"><?= array_sum(array_map(fn($r)=>count($r['absences']),$dataEmps)) ?> abs. total</td>
        </tr>
      </tfoot>
    </table>
    </div>

    <!-- LÉGENDE -->
    <div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:8px;font-size:.72rem;color:#6b7280">
      <strong>Légende :</strong>
      <span style="background:#d5f5e3;padding:1px 6px;border-radius:3px;margin:0 4px">He &gt; Hn = heures supplémentaires</span>
      <span style="background:#fde8e8;padding:1px 6px;border-radius:3px;margin:0 4px">He &lt; Hn = déficit / absence</span>
      <span style="color:#c0392b;margin:0 4px">⚠ = jour(s) d'absence détecté(s)</span>
    </div>

    <div style="margin-top:16px;padding:12px;background:#e8f4ef;border-radius:8px;text-align:center">
      <a href="<?= SITE_URL ?>" style="color:#1a6b4a;font-weight:700;font-size:.86rem;text-decoration:none">📅 Voir le planning complet →</a>
    </div>
  </div>

  <div style="background:#f4f6f5;padding:10px 24px;text-align:center;color:#9ca3af;font-size:.72rem;border-top:1px solid #d1e3da">
    Pharmacie du Marais · Récap mensuel généré le <?= date('d/m/Y à H:i') ?>
  </div>
</div>
</body>
</html>
<?php
$htmlBody = ob_get_clean();

// ── Envoyer ou retourner ──
$mode = $_GET['mode'] ?? 'send';

if ($mode === 'preview') {
    // Retourner le HTML pour aperçu dans l'appli
    header('Content-Type: text/html; charset=utf-8');
    echo $htmlBody;
    exit;
}

// Envoi email
$subject = "Récapitulatif des heures — $moisLabel";
$ok = envoyerMailHTML(TITULAIRE, $subject, $htmlBody, FROM_EMAIL, FROM_NAME);
echo json_encode(['ok'=>$ok, 'mois'=>$moisLabel, 'nbEmployes'=>count($employes)]);

// ── Envoi email via send_mail.php (même config que le reste de l'appli) ──
function envoyerMailHTML($to, $subject, $htmlBody, $from, $fromName) {
    $sendMailUrl = str_replace('cron_recap.php', 'send_mail.php', (isset($_SERVER['HTTPS'])&&$_SERVER['HTTPS']==='on'?'https':'http').'://'.$_SERVER['HTTP_HOST'].$_SERVER['REQUEST_URI']);
    // Appel local via include pour réutiliser la config SMTP
    $phpFile = __DIR__ . '/send_mail.php';
    if (!file_exists($phpFile)) return false;

    // Lire le mot de passe depuis send_mail.php
    $sendMailContent = file_get_contents($phpFile);
    preg_match("/\\\$SMTP_PASS\s*=\s*'([^']+)'/", $sendMailContent, $mPass);
    preg_match("/\\\$SMTP_USER\s*=\s*'([^']+)'/", $sendMailContent, $mUser);
    preg_match("/\\\$SMTP_HOST\s*=\s*'([^']+)'/", $sendMailContent, $mHost);
    preg_match("/\\\$SMTP_PORT\s*=\s*(\d+)/", $sendMailContent, $mPort);

    $smtpHost = $mHost[1] ?? 'mail.infomaniak.com';
    $smtpPort = $mPort[1] ?? 587;
    $smtpUser = $mUser[1] ?? $from;
    $smtpPass = $mPass[1] ?? '';

    if (!$smtpPass) return false;

    $sock = stream_socket_client("tcp://{$smtpHost}:{$smtpPort}", $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 15);
    smtpR($sock); smtpC($sock,"EHLO localhost"); smtpC($sock,"STARTTLS");
    stream_socket_enable_crypto($sock,true,STREAM_CRYPTO_METHOD_TLS_CLIENT);
    smtpC($sock,"EHLO localhost"); smtpC($sock,"AUTH LOGIN");
    smtpC($sock,base64_encode($smtpUser));
    smtpC($sock,base64_encode($smtpPass));
    smtpC($sock,"MAIL FROM:<$from>");
    smtpC($sock,"RCPT TO:<$to>"); smtpC($sock,"DATA");
    $subB64='=?UTF-8?B?'.base64_encode($subject).'?=';
    $nameB64='=?UTF-8?B?'.base64_encode($fromName).'?=';
    $msg="From: {$nameB64} <$from>\r\nTo: $to\r\nSubject: $subB64\r\n";
    $msg.="MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n";
    $msg.=$htmlBody."\r\n.";
    $r=smtpC($sock,$msg); smtpC($sock,"QUIT"); fclose($sock);
    return strpos($r,'250')!==false;
}
function smtpC($s,$c){fwrite($s,$c."\r\n");return smtpR($s);}
function smtpR($s){$r='';while($l=fgets($s,512)){$r.=$l;if(strlen($l)>=4&&$l[3]==' ')break;}return $r;}
