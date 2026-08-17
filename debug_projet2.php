<?php
ini_set('display_errors',1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

// Simuler un appel POST à send_planning_projet.php
$_SERVER['REQUEST_METHOD'] = 'POST';
$GLOBALS['_INPUT'] = json_encode([
    'token' => 'pharmacie-lempdes-cron-2026',
    'projetIdx' => 0,
    'projetNom' => 'Test',
    'state' => ['employes'=>[],'masque'=>[],'masqueStart'=>'','projets'=>[['blockStart'=>'2026-07-01','calendar'=>[]]],'params'=>[]]
]);

// Redéfinir file_get_contents pour php://input
echo "Test inclusion...\n";
ob_start();
// Inclure avec un stream simulé
echo "Fichier send_planning_projet.php taille: ".filesize(__DIR__.'/send_planning_projet.php')." bytes\n";

// Lire et afficher les lignes problématiques
$lines = file(__DIR__.'/send_planning_projet.php');
foreach($lines as $i=>$l){
    if(strpos($l,"'")!==false && strpos($l,'"')!==false && strpos($l,'preg_match')!==false){
        echo "L".($i+1).": ".trim($l)."\n";
    }
}
