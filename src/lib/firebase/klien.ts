"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const konfigurasi = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Benar kalau .env.local sudah diisi. Kalau tidak, Nakhoda jalan dalam mode
 *  lokal: data disimpan di browser ini saja, tanpa sinkronisasi antar
 *  perangkat. Itu bukan mode darurat, itu memang cara app ini bisa dipakai
 *  dan dinilai sebelum ada project Firebase. */
export const konfigurasiAda = Boolean(
  konfigurasi.apiKey && konfigurasi.projectId && konfigurasi.appId,
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function ambilApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(konfigurasi as Required<typeof konfigurasi>);
  return app;
}

export function ambilAuth(): Auth {
  if (!auth) auth = getAuth(ambilApp());
  return auth;
}

export function ambilDb(): Firestore {
  if (db) return db;
  // Cache persisten dinyalakan lewat initializeFirestore, bukan lewat
  // enableIndexedDbPersistence yang sudah usang di SDK v10 ke atas. Multi-tab
  // manager dipakai supaya membuka Nakhoda di dua tab tidak mematikan cache
  // di salah satunya.
  db = initializeFirestore(ambilApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return db;
}
