<?php
// ============================================================
// PUSH_SUBSCRIBE.PHP — Gestion des abonnements push
// ============================================================
header('Content-Type: application/json; charset=utf-8');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

define('SUBS_FILE', __DIR__ . '/push_subscriptions.json');

function loadSubs() {
    if (!file_exists(SUBS_FILE)) return [];
    return json_decode(file_get_contents(SUBS_FILE), true) ?: [];
}
function saveSubs($subs) {
    file_put_contents(SUBS_FILE, json_encode($subs, JSON_PRETTY_PRINT), LOCK_EX);
}

$data = json_decode(file_get_contents('php://input'), true);
$method = $_SERVER['REQUEST_METHOD'];

// ── POST : s'abonner ──
if ($method === 'POST') {
    $empInit = $data['empInit'] ?? '';
    $empNom  = $data['empNom']  ?? '';
    $sub     = $data['subscription'] ?? null;
    if (!$empInit || !$sub) { echo json_encode(['ok'=>false,'error'=>'Données manquantes']); exit; }

    $subs = loadSubs();
    // Remplacer si déjà existant pour cet employé + endpoint
    $subs = array_filter($subs, fn($s) => !($s['empInit']===$empInit && $s['subscription']['endpoint']===$sub['endpoint']));
    $subs[] = ['empInit'=>$empInit,'empNom'=>$empNom,'subscription'=>$sub,'date'=>date('Y-m-d H:i:s')];
    saveSubs(array_values($subs));
    echo json_encode(['ok'=>true]);
    exit;
}

// ── DELETE : se désabonner ──
if ($method === 'DELETE') {
    $endpoint = $data['endpoint'] ?? '';
    $empInit  = $data['empInit']  ?? '';
    if (!$endpoint) { echo json_encode(['ok'=>false,'error'=>'Endpoint manquant']); exit; }
    $subs = loadSubs();
    $subs = array_filter($subs, fn($s) => $s['subscription']['endpoint'] !== $endpoint);
    saveSubs(array_values($subs));
    echo json_encode(['ok'=>true]);
    exit;
}

// ── GET : liste des abonnés (admin) ──
if ($method === 'GET') {
    // Avec token → retourner les abonnements complets pour server.js
    if (($_GET['token'] ?? '') === 'pharmacie-lempdes-cron-2026') {
        $subs = loadSubs();
        echo json_encode(['ok'=>true,'subs'=>$subs]);
        exit;
    }
    $subs = loadSubs();
    $summary = array_map(fn($s) => ['empInit'=>$s['empInit'],'empNom'=>$s['empNom'],'date'=>$s['date']], $subs);
    echo json_encode(['ok'=>true,'count'=>count($subs),'subscribers'=>$summary]);
    exit;
}

echo json_encode(['ok'=>false,'error'=>'Méthode non autorisée']);
