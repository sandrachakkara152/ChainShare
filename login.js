function showRegister() {
    document.getElementById("registerBox").style.display = "block";
}

function registerUser() {
    let name = document.getElementById("regName").value;
    let email = document.getElementById("regEmail").value;
    let password = document.getElementById("regPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all details");
        return;
    }

    localStorage.setItem("userEmail", email);
    localStorage.setItem("userPassword", password);

    alert("Registration successful!");
}

function loginUser(event) {
    event.preventDefault();

    let email = document.getElementById("email").value;
    let password = document.getElementById("password").value;

    if (
        email === localStorage.getItem("userEmail") &&
        password === localStorage.getItem("userPassword")
    ) {
        window.location.href = "index.html";
    } else {
        alert("Invalid email or password. Please register first.");
    }
}