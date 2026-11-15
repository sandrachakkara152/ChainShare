// Initialize ChainShare Blockchain

const chainShareBlockchain = new Blockchain();

const blockchainReady =
    chainShareBlockchain.createGenesisBlock();
let currentChat = "";
let chatHistory = JSON.parse(
    localStorage.getItem("chainShareChats") || "{}"
);

function saveChatMessage(name, text, time) {
    if (!chatHistory[name]) {
        chatHistory[name] = [];
    }

    chatHistory[name].push({ text, time });

    localStorage.setItem(
        "chainShareChats",
        JSON.stringify(chatHistory)
    );
}
// IndexedDB File Storage

const dbRequest = indexedDB.open("ChainShareDB", 2);

dbRequest.onupgradeneeded = function(event) {
    const db = event.target.result;

    if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", {
            keyPath: "id",
            autoIncrement: true
        });
    }

    if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", {
            keyPath: "id"
        });
    }
};

const dbPromise = new Promise((resolve, reject) => {

    dbRequest.onsuccess = () => {
        resolve(dbRequest.result);
    };

    dbRequest.onerror = () => {
        reject(dbRequest.error);
    };

});

function getFileDB() {
    return dbPromise;
}
async function getEncryptionKey() {
    const db = await getFileDB();

    const existingKey = await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", "readonly");

        const request = tx.objectStore("keys").get("fileKey");

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    if (existingKey) {
        return existingKey.key;
    }

    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );

    await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", "readwrite");

        tx.objectStore("keys").put({
            id: "fileKey",
            key: key
        });

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });

    return key;
}

// Save encrypted uploaded file
async function saveFileToDB(file, chatName) {

    const key = await getEncryptionKey();

    const iv = crypto.getRandomValues(
        new Uint8Array(12)
    );

    const fileData = await file.arrayBuffer();

    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        fileData
    );

    const encryptedBlob = new Blob(
        [encryptedData],
        { type: "application/octet-stream" }
    );

    const db = await getFileDB();

    return new Promise((resolve, reject) => {

        const tx = db.transaction("files", "readwrite");

        const request = tx.objectStore("files").add({
            chat: chatName,
            name: file.name,
            type: file.type,
            blob: encryptedBlob,
            iv: iv,
            encrypted: true,
            date: new Date().toLocaleString()
        });

        let fileId;

        request.onsuccess = () => {
            fileId = request.result;
        };

        tx.oncomplete = () => resolve(fileId);
        tx.onerror = () => reject(tx.error);
    });
}

// Get files for a contact
async function getChatFiles(chatName) {
    const db = await getFileDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readonly");
        const request = tx.objectStore("files").getAll();

        request.onsuccess = () => {
            resolve(request.result.filter(
                item => item.chat === chatName
            ));
        };

        request.onerror = () => reject(request.error);
    });
}

async function downloadSavedFile(id) {

    try {
        const db = await getFileDB();

        const item = await new Promise((resolve, reject) => {

            const tx = db.transaction("files", "readonly");
            const request = tx.objectStore("files").get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);

        });

        if (!item) {
            alert("File not found!");
            return;
        }

        const key = await getEncryptionKey();

        const encryptedData = await item.blob.arrayBuffer();

        const decryptedData = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: item.iv
            },
            key,
            encryptedData
        );

        const blob = new Blob(
            [decryptedData],
            { type: item.type }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = item.name;
        link.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

    } catch (error) {
        console.error(error);
        alert("File decryption failed!");
    }
}

function openChat(name) {
    currentChat = name;

    document.getElementById("chatName").innerText = name;

    document.getElementById("messages").innerHTML = "";
    (chatHistory[name] || []).forEach(item => {
    let msg = document.createElement("div");
    msg.className = "message";

    let content = document.createElement("div");
    content.textContent = item.text;

    let time = document.createElement("small");
    time.textContent = item.time;

    msg.appendChild(content);
    msg.appendChild(time);

    document.getElementById("messages").appendChild(msg);
});
}
  async function sendFile() {

    let fileInput = document.getElementById("file");
    let file = fileInput.files[0];

    if (!currentChat) {
        alert("Please select a contact first!");
        return;
    }

    if (!file) {
        alert("Please select a file!");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("File size should be less than 10MB!");
        return;
    }

    try {
        let fileId = await saveFileToDB(file, currentChat);
        // Wait for Blockchain initialization
await blockchainReady;

// Generate SHA-256 file hash
const fileBuffer = await file.arrayBuffer();

const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    fileBuffer
);

const hashArray = Array.from(new Uint8Array(hashBuffer));

const fileHash = hashArray.map(
    byte => byte.toString(16).padStart(2, "0")
).join("");

// Add file record to Blockchain
const block = await chainShareBlockchain.addBlock({
    type: "FILE_UPLOAD",
    fileName: file.name,
    chat: currentChat,
    fileHash: fileHash,
    fileId: fileId
});

console.log("File added to Blockchain:", block);
console.log("File Hash:", fileHash);

        let messages = document.getElementById("messages");

        let msg = document.createElement("div");
        msg.className = "message";

        let title = document.createElement("p");
        title.textContent = "🔐 " + file.name;

        let link = document.createElement("a");
        link.textContent = "Download & Decrypt";
        link.href = "#";

        link.onclick = function(event) {
            event.preventDefault();
            downloadSavedFile(fileId);
        };

        msg.appendChild(title);
        msg.appendChild(link);
        messages.appendChild(msg);

        alert("File encrypted successfully!");

        fileInput.value = "";

    } catch (error) {
        console.error(error);
        alert("File encryption failed!");
    }
}
function sendMessage() {
    let input = document.getElementById("message");
    let text = input.value.trim();

    if (!currentChat) {
        alert("Please select a contact first!");
        return;
    }

    if (text === "") return;

    let msg = document.createElement("div");
    msg.className = "message";

    let content = document.createElement("div");
    content.textContent = text;

    let time = document.createElement("small");
    time.textContent = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    }) + " ✓✓";

    msg.appendChild(content);
    msg.appendChild(time);

    document.getElementById("messages").appendChild(msg);
    saveChatMessage(currentChat, text, time.textContent);
    input.value = "";
}
function updateStatus() {
    let status = document.createElement("p");
    status.id = "myStatus";
    status.textContent = "🟢 Online";

    document.body.appendChild(status);
}

updateStatus();
// Display Blockchain Records

async function showBlockchain() {

    await blockchainReady;

    const records = document.getElementById("blockchainRecords");

    records.innerHTML = "";

    for (const block of chainShareBlockchain.chain) {

        const card = document.createElement("div");

        card.innerHTML = `
            <h3>Block ${block.index}</h3>
            <p><b>Timestamp:</b> ${block.timestamp}</p>
            <p><b>File Name:</b> ${
                block.data.fileName || "Genesis Block"
            }</p>
            <p><b>File Hash:</b> ${
                block.data.fileHash || "N/A"
            }</p>
            <p><b>Previous Hash:</b> ${block.previousHash}</p>
            <p><b>Block Hash:</b> ${block.hash}</p>
            <hr>
        `;

        records.appendChild(card);
    }

    const valid = await chainShareBlockchain.isChainValid();

    const status = document.createElement("h3");

    status.textContent = valid
        ? "✅ Blockchain is Valid"
        : "❌ Blockchain is Invalid";

    records.appendChild(status);
}