// static/login.js

function showRegisterForm() {
    document.getElementById("login-module").classList.add("hidden");
    document.getElementById("register-module").classList.remove("hidden");
}

function showLoginForm() {
    document.getElementById("register-module").classList.add("hidden");
    document.getElementById("login-module").classList.remove("hidden");
}
