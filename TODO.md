

## 🔐 **Device-bound Key Pair (Public/Private Key)**

---

# 🔑 **1. deviceId – wie wird es generiert?**


### 👉 Persistente Device-ID im Client

```ts
const deviceId = crypto.randomUUID();
localStorage.setItem('deviceId', deviceId);
```



# 🔐 **2. SIGNATURE – der wichtigste Teil**


---

## 👉 Prinzip:

Client erzeugt:

```text
Private Key (nur Client)
Public Key (Server gespeichert)
```

---

# 🧱 **3. Key Generation (Client)**

### 👉 WebCrypto API

```ts
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'ECDSA',
    namedCurve: 'P-256',
  },
  true,
  ['sign', 'verify'],
);
```

---

## 👉 Export Public Key

```ts
const publicKey = await crypto.subtle.exportKey(
  'spki',
  keyPair.publicKey,
);

const publicKeyBase64 = btoa(
  String.fromCharCode(...new Uint8Array(publicKey)),
);
```

👉 wird an Backend geschickt:

```ts
activateDevice({
  ticketId,
  publicKey: publicKeyBase64,
  deviceId,
});
```

---

## 👉 Private Key speichern

```ts
await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
```

👉 speichern in:

* IndexedDB (empfohlen)
* oder localStorage (weniger sicher)

---

# ✍️ **4. Signature erstellen**

Bei jedem Scan:

```ts
const encoder = new TextEncoder();
const data = encoder.encode(token);

const signatureBuffer = await crypto.subtle.sign(
  {
    name: 'ECDSA',
    hash: 'SHA-256',
  },
  privateKey,
  data,
);

const signature = btoa(
  String.fromCharCode(...new Uint8Array(signatureBuffer)),
);
```

---

# 📡 **5. Request zum Server**

```ts
{
  token: "...",
  signature: "...",
  deviceId: "..."
}
```

---

# 🔍 **6. Server prüft**

```ts
verifySignature(token, signature, publicKey)
```

👉 wenn gültig:

* nur dieses Gerät kann signieren
* nur dieser User hat dieses Ticket

---

# 🧠 **Wichtige Security-Eigenschaften**

| Feature               | Wirkung           |
| --------------------- | ----------------- |
| Private Key im Client | nicht übertragbar |
| Public Key im Server  | verifizierbar     |
| Signature             | fälschungssicher  |
| deviceId              | mapping           |

---

# 🔥 **Warum dein System damit perfekt wird**

## Angriff: QR teilen

❌ funktioniert nicht
→ anderes Gerät hat keinen Private Key

---

## Angriff: Token klauen

❌ funktioniert nicht
→ Signature fehlt

---

## Angriff: deviceId spoofen

❌ funktioniert nicht
→ Signature passt nicht

---

# ⚠️ **KRITISCHER FEHLER den viele machen**

👉 deviceId als Security benutzen

```ts
if (deviceId === savedDeviceId) ✅
```

👉 das ist unsicher!

---

## 👉 richtige Logik:

```ts
verifySignature(...) ✅
AND
deviceId === storedDeviceId (optional)
```

---

# 🧠 **Dein finales Modell**

```text
Client:
  - generiert KeyPair
  - speichert Private Key
  - sendet Public Key

Server:
  - speichert Public Key
  - prüft Signatur

Flow:
  Token → sign → send → verify
```

---

# 🚀 **Production Upgrade (optional)**

Wenn du noch weiter gehen willst:

### 👉 zusätzlich signieren:

```ts
token + deviceId + timestamp
```