import os
import sqlite3
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

APP_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(APP_DIR, "cloudkitap.db")


def utc_iso():
    return datetime.now(timezone.utc).isoformat()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          synopsis TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS book_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(book_id) REFERENCES user_books(id) ON DELETE CASCADE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          points INTEGER NOT NULL DEFAULT 0,
          first_free_book_key TEXT,
          created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS book_unlocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          book_key TEXT NOT NULL,
          unlocked_at TEXT NOT NULL,
          UNIQUE(user_id, book_key),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_reading (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          book_key TEXT NOT NULL,
          pages_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_writing (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          pages_written INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS reward_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reward_date TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          points_awarded INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(reward_date, user_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    conn.commit()
    conn.close()


app = Flask(__name__, static_folder=None)
CORS(app)


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/books")
def list_books():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, author, synopsis, created_at FROM user_books ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/books")
def create_book():
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get("title") or "").strip()
    author = (data.get("author") or "").strip()
    synopsis = (data.get("synopsis") or "").strip()
    content = (data.get("content") or "").strip()

    if not title or not author or not synopsis or not content:
        return jsonify({"error": "title, author, synopsis, content zorunlu"}), 400

    user_id = data.get("user_id")
    conn = get_db()
    cur = conn.cursor()
    created_at = utc_iso()
    cur.execute(
        "INSERT INTO user_books(title, author, synopsis, content, created_at) VALUES(?,?,?,?,?)",
        (title, author, synopsis, content, created_at),
    )
    book_id = cur.lastrowid
    if user_id:
      try:
        uid = int(user_id)
        pages_written = max(1, len(content.split()) // 250)
        cur.execute(
            "INSERT INTO user_writing(user_id, pages_written, created_at) VALUES(?,?,?)",
            (uid, pages_written, created_at),
        )
      except (ValueError, TypeError):
        pass
    conn.commit()
    conn.close()

    return jsonify(
        {
            "id": book_id,
            "title": title,
            "author": author,
            "synopsis": synopsis,
            "content": content,
            "created_at": created_at,
        }
    )


@app.post("/api/auth/register")
def register_user():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if len(username) < 3 or len(password) < 3:
        return jsonify({"error": "username ve password en az 3 karakter olmalı"}), 400

    conn = get_db()
    try:
        cur = conn.cursor()
        created_at = utc_iso()
        cur.execute(
            "INSERT INTO users(username, password, points, first_free_book_key, created_at) VALUES(?,?,?,?,?)",
            (username, password, 0, None, created_at),
        )
        user_id = cur.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Bu kullanıcı adı zaten alınmış"}), 400
    conn.close()
    return jsonify(
        {
            "id": user_id,
            "username": username,
            "points": 0,
            "first_free_book_key": None,
            "created_at": created_at,
        }
    )


@app.post("/api/auth/login")
def login_user():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    conn = get_db()
    row = conn.execute(
        "SELECT id, username, points, first_free_book_key, created_at FROM users WHERE username=? AND password=?",
        (username, password),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Kullanıcı adı veya şifre hatalı"}), 401
    return jsonify(dict(row))


@app.get("/api/users/<int:user_id>/profile")
def user_profile(user_id: int):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, points, first_free_book_key, created_at FROM users WHERE id=?",
        (user_id,),
    ).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "not_found"}), 404
    read_pages = (
        conn.execute(
            "SELECT COALESCE(SUM(pages_read), 0) AS v FROM user_reading WHERE user_id=?",
            (user_id,),
        ).fetchone()["v"]
        or 0
    )
    written_pages = (
        conn.execute(
            "SELECT COALESCE(SUM(pages_written), 0) AS v FROM user_writing WHERE user_id=?",
            (user_id,),
        ).fetchone()["v"]
        or 0
    )
    conn.close()
    data = dict(user)
    data["read_pages"] = int(read_pages)
    data["written_pages"] = int(written_pages)
    return jsonify(data)


@app.post("/api/books/open")
def open_book():
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    book_key = (data.get("book_key") or "").strip().lower()
    if not user_id or not book_key:
        return jsonify({"error": "user_id ve book_key zorunlu"}), 400

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return jsonify({"error": "geçersiz user_id"}), 400

    conn = get_db()
    cur = conn.cursor()
    user = cur.execute(
        "SELECT id, points, first_free_book_key FROM users WHERE id=?",
        (uid,),
    ).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "not_found"}), 404

    unlocked = cur.execute(
        "SELECT 1 FROM book_unlocks WHERE user_id=? AND book_key=?",
        (uid, book_key),
    ).fetchone()
    if unlocked:
        conn.close()
        return jsonify({"ok": True, "already_unlocked": True, "cost": 0})

    now = utc_iso()
    if not user["first_free_book_key"]:
        cur.execute(
            "UPDATE users SET first_free_book_key=? WHERE id=?",
            (book_key, uid),
        )
        cur.execute(
            "INSERT INTO book_unlocks(user_id, book_key, unlocked_at) VALUES(?,?,?)",
            (uid, book_key, now),
        )
        conn.commit()
        conn.close()
        return jsonify(
            {"ok": True, "first_book_free": True, "cost": 0, "message": "İlk seçtiğin kitap ücretsiz açıldı"}
        )

    if int(user["points"]) < 10:
        conn.close()
        return jsonify({"error": "Yetersiz puan. Kitap açmak için 10 puan gerekir."}), 400

    cur.execute("UPDATE users SET points = points - 10 WHERE id=?", (uid,))
    cur.execute(
        "INSERT INTO book_unlocks(user_id, book_key, unlocked_at) VALUES(?,?,?)",
        (uid, book_key, now),
    )
    conn.commit()
    updated = cur.execute("SELECT points FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return jsonify({"ok": True, "cost": 10, "remaining_points": int(updated["points"])})


@app.post("/api/activity/read")
def log_reading():
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    book_key = (data.get("book_key") or "").strip().lower()
    pages_read = int(data.get("pages_read") or 1)
    if not user_id or not book_key:
        return jsonify({"error": "user_id ve book_key zorunlu"}), 400
    pages_read = max(1, pages_read)
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return jsonify({"error": "geçersiz user_id"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO user_reading(user_id, book_key, pages_read, created_at) VALUES(?,?,?,?)",
        (uid, book_key, pages_read, utc_iso()),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.post("/api/activity/write")
def log_writing():
    data = request.get_json(force=True, silent=True) or {}
    user_id = data.get("user_id")
    pages_written = int(data.get("pages_written") or 1)
    if not user_id:
        return jsonify({"error": "user_id zorunlu"}), 400
    pages_written = max(1, pages_written)
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return jsonify({"error": "geçersiz user_id"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO user_writing(user_id, pages_written, created_at) VALUES(?,?,?)",
        (uid, pages_written, utc_iso()),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


def apply_daily_rewards(conn):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    already = conn.execute(
        "SELECT 1 FROM reward_history WHERE reward_date=? LIMIT 1",
        (today,),
    ).fetchone()
    if already:
        return

    rows = conn.execute(
        """
        SELECT
          u.id,
          COALESCE(r.read_pages, 0) AS read_pages,
          COALESCE(w.written_pages, 0) AS written_pages,
          (COALESCE(r.read_pages, 0) + COALESCE(w.written_pages, 0)) AS total_pages
        FROM users u
        LEFT JOIN (
          SELECT user_id, SUM(pages_read) AS read_pages
          FROM user_reading
          GROUP BY user_id
        ) r ON r.user_id = u.id
        LEFT JOIN (
          SELECT user_id, SUM(pages_written) AS written_pages
          FROM user_writing
          GROUP BY user_id
        ) w ON w.user_id = u.id
        ORDER BY total_pages DESC, u.id ASC
        LIMIT 3
        """
    ).fetchall()
    rewards = [10, 5, 2]
    cur = conn.cursor()
    for idx, row in enumerate(rows):
        if int(row["total_pages"]) <= 0:
            continue
        pts = rewards[idx]
        cur.execute("UPDATE users SET points = points + ? WHERE id=?", (pts, row["id"]))
        cur.execute(
            "INSERT INTO reward_history(reward_date, user_id, points_awarded, created_at) VALUES(?,?,?,?)",
            (today, row["id"], pts, utc_iso()),
        )
    conn.commit()


@app.get("/api/leaderboard")
def leaderboard():
    conn = get_db()
    apply_daily_rewards(conn)
    rows = conn.execute(
        """
        SELECT
          u.id,
          u.username,
          u.points,
          COALESCE(r.read_pages, 0) AS read_pages,
          COALESCE(w.written_pages, 0) AS written_pages,
          (COALESCE(r.read_pages, 0) + COALESCE(w.written_pages, 0)) AS total_pages
        FROM users u
        LEFT JOIN (
          SELECT user_id, SUM(pages_read) AS read_pages
          FROM user_reading
          GROUP BY user_id
        ) r ON r.user_id = u.id
        LEFT JOIN (
          SELECT user_id, SUM(pages_written) AS written_pages
          FROM user_writing
          GROUP BY user_id
        ) w ON w.user_id = u.id
        ORDER BY total_pages DESC, u.points DESC, u.id ASC
        """
    ).fetchall()
    conn.close()
    rewards = {1: 10, 2: 5, 3: 2}
    out = []
    for idx, row in enumerate(rows, start=1):
        item = dict(row)
        item["rank"] = idx
        item["rank_reward"] = rewards.get(idx, 0)
        out.append(item)
    return jsonify(out)


@app.get("/api/books/<int:book_id>")
def get_book(book_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT id, title, author, synopsis, content, created_at FROM user_books WHERE id=?",
        (book_id,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not_found"}), 404
    return jsonify(dict(row))


@app.get("/api/books/<int:book_id>/comments")
def list_comments(book_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, book_id, name, body, created_at FROM book_comments WHERE book_id=? ORDER BY id DESC",
        (book_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/books/<int:book_id>/comments")
def create_comment(book_id: int):
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip() or "Anonim"
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "body zorunlu"}), 400

    conn = get_db()
    exists = conn.execute("SELECT 1 FROM user_books WHERE id=?", (book_id,)).fetchone()
    if not exists:
        conn.close()
        return jsonify({"error": "not_found"}), 404

    created_at = utc_iso()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO book_comments(book_id, name, body, created_at) VALUES(?,?,?,?)",
        (book_id, name, body, created_at),
    )
    comment_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify(
        {
            "id": comment_id,
            "book_id": book_id,
            "name": name,
            "body": body,
            "created_at": created_at,
        }
    )


# ---- Static site (serve existing html/css/js) ----
@app.get("/")
def root():
    return send_from_directory(APP_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path: str):
    return send_from_directory(APP_DIR, path)


if __name__ == "__main__":
    init_db()
    # "online" (LAN): host=0.0.0.0
    app.run(host="0.0.0.0", port=10000)

