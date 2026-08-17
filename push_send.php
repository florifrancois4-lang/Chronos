<?php
// ============================================================
// PUSH_SEND.PHP — Web Push VAPID via Minishlink/WebPush
// ============================================================
if (!defined('VAPID_PUBLIC_KEY'))  define('VAPID_PUBLIC_KEY',  'BHZvuV-eeNFwSO0RYZaJFKvCNzR09PfgZ2ebyLlOlxb9VlaA_jm2XInUqMZhDqxwp8bcLKmL97cre1HpFd0KSFA');
if (!defined('VAPID_PRIVATE_KEY')) define('VAPID_PRIVATE_KEY', 'uWdX6fWfcEsxkNIa3xDvlFTT9kCeNsoycuI_RRHMTSE');
if (!defined('PUSH_SUBS_FILE'))    define('PUSH_SUBS_FILE',    __DIR__ . '/push_subscriptions.json');

function b64url_encode(string $s): string { return rtrim(strtr(base64_encode($s),'+/','-_'),'='); }
function b64url_decode(string $s): string { return base64_decode(strtr($s,'-_','+/').str_repeat('=',(4-strlen($s)%4)%4)); }

function loadSubs(): array {
    if (!file_exists(PUSH_SUBS_FILE)) return [];
    return json_decode(file_get_contents(PUSH_SUBS_FILE), true) ?? [];
}

function makeVapidJWT(string $endpoint): string {
    $parts   = parse_url($endpoint);
    $aud     = $parts['scheme'].'://'.$parts['host'];
    $head    = b64url_encode('{"typ":"JWT","alg":"ES256"}');
    $claim   = b64url_encode(json_encode(['aud'=>$aud,'exp'=>time()+43200,'sub'=>'mailto:francois.flori@pharmaciedumarais.net']));
    $unsigned = "$head.$claim";

    // Charger la clé privée EC P-256 depuis les bytes bruts
    $privBytes = b64url_decode(VAPID_PRIVATE_KEY);
    $privBytes = str_pad($privBytes, 32, "\x00", STR_PAD_LEFT);

    // Encoder en DER PKCS8 pour P-256
    // Structure: SEQUENCE { SEQUENCE { OID ecPublicKey, OID prime256v1 }, BIT STRING { OCTET STRING { privKey } } }
    $privDer = "\x30\x41"           // SEQUENCE (65 bytes)
             . "\x02\x01\x01"       // INTEGER version=1
             . "\x04\x20"           // OCTET STRING (32 bytes)
             . $privBytes
             . "\xa0\x0a"           // [0] (10 bytes)
             . "\x06\x08"           // OID (8 bytes)
             . "\x2a\x86\x48\xce\x3d\x03\x01\x07"; // prime256v1

    $pem = "-----BEGIN EC PRIVATE KEY-----\n"
         . chunk_split(base64_encode($privDer), 64, "\n")
         . "-----END EC PRIVATE KEY-----";

    $key = openssl_pkey_get_private($pem);
    if (!$key) return '';

    openssl_sign($unsigned, $der, $key, OPENSSL_ALGO_SHA256);

    // Parse DER signature → R||S
    $i=2; if(ord($der[$i])===0x81)$i++;
    $i++; $rlen=ord($der[$i++]); $r=substr($der,$i,$rlen); $i+=$rlen;
    $i++; $slen=ord($der[$i++]); $s=substr($der,$i,$slen);
    $r=str_pad(ltrim($r,"\x00"),32,"\x00",STR_PAD_LEFT);
    $s=str_pad(ltrim($s,"\x00"),32,"\x00",STR_PAD_LEFT);

    return $unsigned.'.'.b64url_encode($r.$s);
}

function sendPushNotification(array $subscription, array $payload): array {
    $notifyUrl = 'https://info.pharmaciedumarais.net/api/notify-planning';
    $empInit   = $payload['empInit'] ?? '';
    $body = json_encode([
        'token'   => 'pharmacie-lempdes-cron-2026',
        'empInit' => $empInit,
        'title'   => $payload['title'] ?? 'Planning',
        'body'    => $payload['body']  ?? '',
    ]);
    $ch = curl_init($notifyUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($body),
        ],
    ]);
    $response = curl_exec($ch);
    $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err      = curl_error($ch);
    curl_close($ch);
    return ['code'=>$code,'response'=>$response,'error'=>$err];
}

function sendToEmployee(string $empInit, array $payload): array {
    $payload['empInit'] = $empInit;
    return [sendPushNotification([], $payload)];
}

function sendToAll(array $payload): array {
    $results=[];
    foreach(loadSubs() as $sub)
        $results[$sub['empInit']]=sendPushNotification($sub['subscription'],$payload);
    return $results;
}
