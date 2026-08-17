<?php
$f = __DIR__ . '/send_mail.php';
if (!file_exists($f)) { echo "send_mail.php introuvable"; exit; }
$c = file_get_contents($f);
// Afficher les 20 premières lignes
$lines = explode("\n", $c);
foreach (array_slice($lines, 0, 20) as $i => $l) {
    echo ($i+1).": ".htmlspecialchars($l)."\n";
}
