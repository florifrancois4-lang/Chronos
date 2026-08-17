<?php
ini_set('display_errors',1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

// Test lireSMTP
$f = __DIR__ . '/send_mail.php';
echo "send_mail.php existe: ".(file_exists($f)?'OUI':'NON')."\n";
if(file_exists($f)){
    $c = file_get_contents($f);
    preg_match("/\\\$SMTP_HOST\s*=\s*['\"]([^'\"]+)['\"]/", $c, $mH);
    preg_match("/\\\$SMTP_PORT\s*=\s*(\d+)/", $c, $mP);
    preg_match("/\\\$SMTP_USER\s*=\s*['\"]([^'\"]+)['\"]/", $c, $mU);
    preg_match("/\\\$SMTP_PASS\s*=\s*['\"]([^'\"]+)['\"]/", $c, $mPw);
    echo "HOST: ".($mH[1]??'NON TROUVÉ')."\n";
    echo "PORT: ".($mP[1]??'NON TROUVÉ')."\n";
    echo "USER: ".($mU[1]??'NON TROUVÉ')."\n";
    echo "PASS: ".(isset($mPw[1])&&$mPw[1]?'OK':'NON TROUVÉ')."\n";
}

// Test inclusion send_planning_projet.php pour voir l'erreur
echo "\n--- Test syntaxe ---\n";
$output = shell_exec('php -l '.escapeshellarg(__DIR__.'/send_planning_projet.php').' 2>&1');
echo $output ?: "shell_exec non disponible\n";
