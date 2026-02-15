# 🐚 Totorum Web Shell

A minimal, web-based shell page for **Next.js** — built for **CTFs** and **authorized penetration testing**.


## ✨ Features

- 🔐 **Password-gated access** via query parameter (`?pw=...`)
- ⚡ **Command execution** using `node:child_process`
- 📁 **Working directory persistence** between commands
- 🧾 **Command + output history** stored in cookies


## 🚀 Quick Start

### 1) Add the page

Copy `page.tsx` into your target app, for example:

```
/app/shell/page.tsx
```

### 2) Set your password hash

Replace `SECRET` with the **SHA-256** hash of your password:

```ts
const SECRET = "your_sha256_hash_here";
```

### 3) Open the shell

Visit the route with your password:

```
http://target.local/shell?pw=your-password
```

### 4) Run commands

Type commands into the UI and execute them. ✅


## ⚙️ Notes / Limits

- ⏱️ Command timeout: **60s**
- 📦 Max output buffer: **10MB**
- 🐧 Shell used: **`/bin/bash`**


## ⚠️ Disclaimer

This software is intended for **lawful security testing and educational purposes only**. Use it **only** on systems you own or where you have **explicit written permission** to test. Unauthorized use may be illegal and is strictly prohibited.

**NO WARRANTY:** This software is provided **“AS IS”**, without warranties of any kind. You assume all risk. The author is not responsible for any misuse or damage caused by this software.

✅ **Stay legal.**
