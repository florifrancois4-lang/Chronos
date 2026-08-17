#!/usr/bin/env node
// vapid_send.js — Envoi notification push via web-push
// Usage: node vapid_send.js <endpoint> <p256dh> <auth> <title> <body> <empInit>

const webpush = require('web-push');

const VAPID_PUBLIC  = 'BHZvuV-eeNFwSO0RYZaJFKvCNzR09PfgZ2ebyLlOlxb9VlaA_jm2XInUqMZhDqxwp8bcLKmL97cre1HpFd0KSFA';
const VAPID_PRIVATE = 'uWdX6fWfcEsxkNIa3xDvlFTT9kCeNsoycuI_RRHMTSE';

webpush.setVapidDetails(
    'mailto:contact@pharmaciedumarais.net',
    VAPID_PUBLIC,
    VAPID_PRIVATE
);

const [,, endpoint, p256dh, auth, title, body, tag] = process.argv;

const subscription = {
    endpoint,
    keys: { p256dh, auth }
};

const payload = JSON.stringify({ title, body, tag: tag||'alerte', url: '/' });

webpush.sendNotification(subscription, payload)
    .then(r => { console.log('OK:' + r.statusCode); process.exit(0); })
    .catch(e => { console.log('ERR:' + e.statusCode + ':' + e.message); process.exit(1); });
