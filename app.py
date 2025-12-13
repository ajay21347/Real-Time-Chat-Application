from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
from db import get_connection
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret"
socketio = SocketIO(app, cors_allowed_origins="*")

online_users = {}

import os
print("PGHOST =", os.getenv("PGHOST"))
print("PGPORT =", os.getenv("PGPORT"))


# ----------------------------------
# HOME (LOGIN or CHAT)
# ----------------------------------
@app.route("/")
def home():
    if session.get("username"):
        return render_template("index.html", username=session["username"])
    return render_template("login.html")


# ----------------------------------
# REGISTER
# ----------------------------------
@app.route("/register", methods=["POST"])
def register():
    username = request.form["username"]
    password = request.form["password"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (username, password) VALUES (%s, %s)",
            (username, password),
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
    username = request.form["username"]
    password = request.form["password"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE username=%s AND password=%s",
        (username, password),
    )
    user = cur.fetchone()

    cur.close()
    conn.close()

    if user:
        session["username"] = username
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
    sender = data["username"]
    receiver = data["receiver"]
    message = data["message"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (sender, receiver, message) VALUES (%s, %s, %s)",
        (sender, receiver, message),
    )
    conn.commit()
    cur.close()
    conn.close()

    if receiver in online_users:
        emit(
            "private_message",
            {"sender": sender, "message": message},
            room=online_users[receiver],
        )


# ----------------------------------
# RUN
# ----------------------------------
if __name__ == "__main__":
    socketio.run(app, debug=True)
