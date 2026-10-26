import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { registerRoomHandlers } from "./sockets/roomHandlers.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = Number(process.env.PORT) || 5000;

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to ColorFlip API! 🎮",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "ColorFlip Backend",
  });
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  registerRoomHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 ColorFlip server running on port ${PORT}`);
});
