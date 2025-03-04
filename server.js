const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"],
        allowEIO3: true
    }
});

app.use(cors());
app.use(express.static("public"));

let waitingUsers = [];

io.on("connection", (socket) => {
    console.log(`✅ Un utente si è connesso: ${socket.id}`);

    function findPartner(socket) {
        let partner = waitingUsers.pop();

        if (partner && partner.socket !== socket) {
            socket.partner = partner.socket;
            partner.socket.partner = socket;

            console.log(`🔗 Utente ${socket.id} abbinato con ${partner.socket.id}`);

            socket.emit("chat_start", { partnerId: partner.socket.id });
            partner.socket.emit("chat_start", { partnerId: socket.id });
        } else {
            waitingUsers.push({ id: socket.id, socket });
            console.log(`🕐 Utente ${socket.id} in attesa di un partner`);
        }
    }

    socket.on("find_partner", () => {
        console.log(`🔍 Utente ${socket.id} cerca un partner`);
        findPartner(socket);
    });

    socket.on("message", (data) => {
        if (socket.partner) {
            socket.partner.emit("message", data);
            console.log(`💬 Messaggio da ${socket.id} a ${socket.partner.id}: ${data}`);
        }
    });

    socket.on("webrtc_offer", (data) => {
        if (socket.partner) {
            socket.partner.emit("webrtc_offer", { offer: data.offer, from: socket.id });
        }
    });

    socket.on("webrtc_answer", (data) => {
        if (socket.partner) {
            socket.partner.emit("webrtc_answer", { answer: data.answer });
        }
    });

    socket.on("webrtc_candidate", (data) => {
        if (socket.partner) {
            socket.partner.emit("webrtc_candidate", { candidate: data.candidate });
        }
    });

    socket.on("new_search", () => {
        if (socket.partner) {
            socket.partner.emit("partner_left");
            socket.partner.partner = null;
            socket.partner = null;
        }
        socket.partner = null;
        console.log(`🔄 Utente ${socket.id} cerca un nuovo partner`);
        findPartner(socket);
    });

    socket.on("disconnect", () => {
        console.log(`❌ Utente ${socket.id} si è disconnesso`);
        if (socket.partner) {
            socket.partner.emit("partner_left");
            socket.partner.partner = null;
        }
        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server avviato su porta ${PORT}`);
});
