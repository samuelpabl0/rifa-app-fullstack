import dotenv from "dotenv";
dotenv.config({ path: "../.env" });


import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import multer from "multer";
import path from "path";
import fs from "fs";


const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.resolve("uploads");
const backupsDir = path.resolve("backups");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `premio-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

const db = new Database("rifa.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  whatsapp TEXT,
  numbers TEXT,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

const TOTAL = Number(process.env.TOTAL_TICKETS || 200);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

function adminAuth(req, res, next) {
  const password = req.headers["x-admin-password"];

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      message: "Senha admin inválida.",
    });
  }

  next();
}

function getSetting(key, defaultValue) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function createBackup(reason = "manual") {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id ASC").all();
  const settings = db.prepare("SELECT * FROM settings").all();

  const backup = {
    reason,
    createdAt: new Date().toISOString(),
    orders,
    settings,
  };

  const fileName = `backup-${reason}-${Date.now()}.json`;
  const filePath = path.join(backupsDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf-8");

  return fileName;
}

function getStats() {
  const orders = db.prepare("SELECT * FROM orders").all();

  let reservedNumbers = 0;
  let paidNumbers = 0;
  let pendingNumbers = 0;

  orders.forEach((order) => {
    const count = JSON.parse(order.numbers).length;

    reservedNumbers += count;

    if (order.status === "paid") {
      paidNumbers += count;
    }

    if (order.status === "pending") {
      pendingNumbers += count;
    }
  });

  return {
    totalTickets: TOTAL,
    reservedNumbers,
    paidNumbers,
    pendingNumbers,
    freeNumbers: TOTAL - reservedNumbers,
    progressPercent: Math.round((paidNumbers / TOTAL) * 100),
  };
}

app.get("/config", (req, res) => {
  res.json({
    title: getSetting("title", "Rifa Beneficente"),
    prize: getSetting("prize", "Prêmio não definido"),
    price: Number(getSetting("price", 2)),
    imageUrl: getSetting("imageUrl", ""),
    winner: getSetting("winner", ""),
  });
});

app.get("/stats", (req, res) => {
  res.json(getStats());
});

app.post("/admin/config", adminAuth, (req, res) => {
  const { title, prize, price } = req.body;

  setSetting("title", title || "Rifa Beneficente");
  setSetting("prize", prize || "Prêmio não definido");
  setSetting("price", price || 2);

  res.json({ ok: true });
});

app.post("/admin/upload", adminAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "Nenhuma imagem enviada.",
    });
  }

  const oldImage = getSetting("imageUrl", "");

  if (oldImage) {
    const oldPath = path.join(process.cwd(), oldImage);

    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {}
    }
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  setSetting("imageUrl", imageUrl);

  res.json({ ok: true, imageUrl });
});

app.get("/tickets", (req, res) => {
  const rows = db.prepare("SELECT numbers FROM orders").all();
  const used = new Set();

  rows.forEach((r) => {
    JSON.parse(r.numbers).forEach((n) => used.add(n));
  });

  const tickets = [];

  for (let i = 1; i <= TOTAL; i++) {
    tickets.push({
      number: i,
      status: used.has(i) ? "taken" : "free",
    });
  }

  res.json(tickets);
});

app.post("/order", (req, res) => {
  const { name, whatsapp, numbers } = req.body;

  if (!name || !whatsapp || !numbers || numbers.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Dados incompletos.",
    });
  }

  const rows = db.prepare("SELECT numbers FROM orders").all();
  const used = new Set();

  rows.forEach((r) => {
    JSON.parse(r.numbers).forEach((n) => used.add(n));
  });

  const conflict = numbers.find((n) => used.has(n));

  if (conflict) {
    return res.status(409).json({
      ok: false,
      message: `O número ${String(conflict).padStart(3, "0")} já foi reservado.`,
    });
  }

  const stmt = db.prepare(`
    INSERT INTO orders (name, whatsapp, numbers, status)
    VALUES (?, ?, ?, 'pending')
  `);

  const result = stmt.run(name, whatsapp, JSON.stringify(numbers));

  res.json({
    ok: true,
    id: result.lastInsertRowid,
  });
});

app.get("/admin", adminAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  res.json(rows);
});

app.get("/admin/backups", adminAuth, (req, res) => {
  const files = fs
    .readdirSync(backupsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  res.json({ ok: true, backups: files });
});

app.post("/admin/backup", adminAuth, (req, res) => {
  const fileName = createBackup("manual");
  res.json({ ok: true, fileName });
});

app.get("/public/paid", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM orders WHERE status = 'paid' ORDER BY id DESC")
    .all();

  res.json(rows);
});

app.patch("/admin/:id/pay", adminAuth, (req, res) => {
  const { id } = req.params;

  createBackup(`before-pay-${id}`);

  db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(id);

  res.json({ ok: true });
});

app.post("/admin/draw", adminAuth, (req, res) => {
  const paidOrders = db
    .prepare("SELECT * FROM orders WHERE status = 'paid'")
    .all();

  const pool = [];

  paidOrders.forEach((order) => {
    const numbers = JSON.parse(order.numbers);

    numbers.forEach((number) => {
      pool.push({
        number,
        name: order.name,
        whatsapp: order.whatsapp,
      });
    });
  });

  if (pool.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Nenhum número pago para sortear.",
    });
  }

  createBackup("before-draw");

  const winner = pool[Math.floor(Math.random() * pool.length)];
  setSetting("winner", JSON.stringify(winner));

  res.json({ ok: true, winner });
});

app.delete("/admin/reset", adminAuth, (req, res) => {
  const fileName = createBackup("before-reset");

  db.prepare("DELETE FROM orders").run();
  setSetting("winner", "");

  res.json({ ok: true, backup: fileName });
});

app.delete("/admin/winner", adminAuth, (req, res) => {
  createBackup("before-remove-winner");

  setSetting("winner", "");

  res.json({ ok: true });
});

app.delete("/admin/image", adminAuth, (req, res) => {
  const imageUrl = getSetting("imageUrl", "");

  if (imageUrl) {
    const filePath = path.join(process.cwd(), imageUrl);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  }

  setSetting("imageUrl", "");

  res.json({ ok: true });
});

app.delete("/admin/:id", adminAuth, (req, res) => {
  const { id } = req.params;

  createBackup(`before-delete-order-${id}`);

  db.prepare("DELETE FROM orders WHERE id = ?").run(id);

  res.json({ ok: true });
});

app.listen(5000, () => console.log("Backend rodando na 5000"));