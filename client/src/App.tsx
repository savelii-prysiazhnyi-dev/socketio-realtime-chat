import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const App = () => {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onData = (data: string) => {
      console.log("Received data:", data);
      setMessage(data);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("data", onData);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("data", onData);
    };
  }, []);

  return (
    <div>
      <div>Status: {connected ? "connected" : "not connected"}</div>
      {message && <div>Message from server: {message}</div>}
    </div>
  );
};

export default App;
