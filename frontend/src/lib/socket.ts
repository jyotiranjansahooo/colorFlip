import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://colorflip.onrender.com";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});
