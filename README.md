# 📄 Bulk PDF Generator — Local PDF Studio

> **Made by [Tech With Hussain](https://techwithhussain.online/)**

A powerful **offline desktop app** to generate hundreds of personalized PDFs in one click — built with Electron, React, and SQLite.

---

## ✨ Features

- 📝 **Rich Text Editor** — Google Docs-style editor with full formatting
- 🔄 **Bulk PDF Generation** — Generate 50 personalized PDFs at once
- 📊 **CSV / Excel Import** — Use `{{placeholders}}` to personalize each PDF
- 📋 **Paste List** — Paste airline/name list directly (no CSV needed)
- 🔍 **Find & Replace** — Replace keywords across entire template
- 📦 **ZIP Download** — Download all PDFs in one ZIP file
- ✅ **Airline Checklist** — Select/deselect which airlines to generate for
- 💧 **100% Offline** — No internet required, all data stored locally
- 🎨 **Page Settings** — Custom margins, fonts, headers, footers, page numbers

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- Windows 10/11

### Install & Run (Development)

```bash
git clone https://github.com/techwithhussain/Bulk-PDF-Generator.git
cd Bulk-PDF-Generator
npm install
npm run dev
```

### Build EXE (Production)

```bash
npm run build:win
```

Output files in `dist-electron/`:
- `Local PDF Studio Setup 1.0.0.exe` — Installer
- `Local PDF Studio 1.0.0.exe` — Portable (no install needed)

---

## 🛠️ Tech Stack

| Technology | Use |
|------------|-----|
| **Electron** | Desktop app framework |
| **React + Vite** | Frontend UI |
| **Tiptap** | Rich text editor |
| **better-sqlite3** | Local database |
| **Tailwind CSS** | Styling |
| **electron-builder** | Build & packaging |

---

## 📖 How to Use

1. **Create a new project** → Choose "Personalized" mode
2. **Write your template** in the editor
3. Use `{{airline}}` placeholder where the name should change
4. Go to **Generate PDFs** → Import your CSV or paste a list
5. Select airlines → Click **Generate All PDFs**
6. Download as **ZIP** or individual files ✅

---

## 📁 Project Structure

```
Bulk-PDF-Generator/
├── electron/
│   ├── main.js          # Electron entry point
│   ├── preload.js       # IPC bridge
│   ├── db/              # SQLite database setup
│   └── ipc/             # IPC handlers (pdf, export, findReplace...)
├── src/
│   ├── components/      # React components
│   ├── pages/           # App pages
│   ├── store/           # Zustand state management
│   └── index.css        # Global styles
├── airlines_keywords.csv  # Sample airlines data
└── package.json
```

---

## 👨‍💻 Developer

**Tech With Hussain**  
🌐 [techwithhussain.online](https://techwithhussain.online/)  
🐙 [github.com/techwithhussain](https://github.com/techwithhussain)

---

## 📄 License

Private — All rights reserved © 2026 Tech With Hussain
