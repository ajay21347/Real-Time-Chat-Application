from flask import Flask, render_template, request, session, redirect, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_connection
from dotenv import load_dotenv
import random
import os

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "secret")
socketio = SocketIO(app, cors_allowed_origins="*")

online_users = {}


# ----------------------------------
# HOME
# ----------------------------------
@app.route("/")
def home():
    if session.get("username"):
        return render_template(
            "index.html",
            username=session["username"],
            theme=session.get("theme", "blue"),
            avatar=session.get("avatar", "avatar1.png"),
        )
    return render_template("login.html")


# ----------------------------------
# REGISTER
# ----------------------------------
@app.route("/register", methods=["POST"])
def register():
    username = request.form["username"].lower()
    password = request.form["password"]
    hashed_password = generate_password_hash(password)

    avatars = [
        "avatar1.png",
        "avatar2.png",
        "avatar3.png",
        "avatar4.png",
        "avatar5.png",
    ]
    avatar = random.choice(avatars)

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO users (username, password, avatar)
            VALUES (%s, %s, %s)
            """,
            (username, hashed_password, avatar),
        )
        conn.commit()
    except Exception as e:
        print("Register error:", e)
        return "Username already exists"
    finally:
        cur.close()
        conn.close()

    return redirect("/")


# ----------------------------------
# LOGIN
# ----------------------------------
@app.route("/login", methods=["POST"])
def login():
    username = request.form["username"].lower()
    password = request.form["password"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT password, theme, avatar FROM users WHERE username=%s",
        (username,),
    )
    user = cur.fetchone()

    cur.close()
    conn.close()

    if user and check_password_hash(user[0], password):
        session["username"] = username
        session["theme"] = user[1]
        session["avatar"] = user[2]
        return redirect("/")

    return "Invalid credentials"


# ----------------------------------
# LOGOUT
# ----------------------------------
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


# ----------------------------------
# SOCKET.IO EVENTS
# ----------------------------------
@socketio.on("user_connected")
def user_connected(username):
    username = username.lower()
    online_users[username] = request.sid
    emit("user_list", list(online_users.keys()), broadcast=True)


@socketio.on("disconnect")
def disconnect_user():
    for user, sid in list(online_users.items()):
        if sid == request.sid:
            del online_users[user]
            break
    emit("user_list", list(online_users.keys()), broadcast=True)


# ----------------------------------
# PRIVATE MESSAGE
# ----------------------------------
@socketio.on("private_message")
def private_message(data):
    sender = data["username"].lower()
    receiver = data["receiver"].lower()
    message = data["message"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO messages (sender, receiver, message)
        VALUES (%s, %s, %s)
        RETURNING created_at
        """,
        (sender, receiver, message),
    )

    timestamp = cur.fetchone()[0]
    conn.commit()

    cur.close()
    conn.close()

    payload = {
        "sender": sender,
        "message": message,
        "timestamp": timestamp.isoformat(),
    }

    # Send to receiver if online
    if receiver in online_users:
        emit("private_message", payload, room=online_users[receiver])

    # Echo back to sender (multi-tab safe)
    emit("private_message", payload, room=request.sid)


# ----------------------------------
# LOAD CHAT HISTORY
# ----------------------------------
@app.route("/history/<user>")
def chat_history(user):
    if "username" not in session:
        return jsonify([])

    current_user = session["username"]
    user = user.lower()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT sender, message, created_at
        FROM messages
        WHERE 
            (sender=%s AND receiver=%s)
            OR
            (sender=%s AND receiver=%s)
        ORDER BY created_at
        """,
        (current_user, user, user, current_user),
    )

    messages = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify(messages)


# ----------------------------------
# TYPING INDICATOR
# ----------------------------------
@socketio.on("typing")
def typing(data):
    sender = data["sender"].lower()
    receiver = data["receiver"].lower()
    stop = data.get("stop", False)

    if receiver in online_users:
        emit(
            "typing",
            {"sender": sender, "stop": stop},
            room=online_users[receiver],
        )


# ----------------------------------
# SAVE THEME
# ----------------------------------
@app.route("/save-theme", methods=["POST"])
def save_theme():
    if "username" not in session:
        return "", 401

    theme = request.json.get("theme")
    user = session["username"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET theme=%s WHERE username=%s",
        (theme, user),
    )
    conn.commit()

    cur.close()
    conn.close()

    return "", 204


# ----------------------------------
# MARK MESSAGES AS READ
# ----------------------------------
@app.route("/mark-read/<user>", methods=["POST"])
def mark_read(user):
    if "username" not in session:
        return "", 401

    current = session["username"]
    user = user.lower()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE messages
        SET is_read = TRUE
        WHERE sender=%s AND receiver=%s
        """,
        (user, current),
    )
    conn.commit()

    cur.close()
    conn.close()

    return "", 204


# ----------------------------------
# RUN
# ----------------------------------
if __name__ == "__main__":
    socketio.run(app, debug=True)
