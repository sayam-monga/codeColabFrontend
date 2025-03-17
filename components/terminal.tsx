"use client";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

function XTerminal() {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Create terminal instance
    terminalInstance.current = new Terminal();

    // Create WebSocket connection
    wsRef.current = new WebSocket(
      "ws://ec2-18-208-180-165.compute-1.amazonaws.com"
    );

    // Setup WebSocket handlers
    if (wsRef.current) {
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "data" && terminalInstance.current) {
          terminalInstance.current.write(data.data);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket connection closed");
      };
    }

    // Initialize terminal if container is ready
    if (terminalRef.current && terminalInstance.current) {
      terminalInstance.current.open(terminalRef.current);

      // Setup terminal key handler
      terminalInstance.current.onKey((e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "command",
              data: e.key,
            })
          );
        }
      });
    }

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, []); // Empty dependency array since we only want to run this once

  return <div className="h-full w-full" ref={terminalRef}></div>;
}

export default XTerminal;
