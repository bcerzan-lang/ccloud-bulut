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

    conn = get_db()
    cur = conn.cursor()
    created_at = utc_iso()
    cur.execute(
        "INSERT INTO user_books(title, author, synopsis, content, created_at) VALUES(?,?,?,?,?)",
        (title, author, synopsis, content, created_at),
    )
    book_id = cur.lastrowid
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
    app.run(host="0.0.0.0", port=8000, debug=True)

