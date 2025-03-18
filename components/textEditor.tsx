"use client";
import React, { useEffect, useState, useRef } from "react";
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import { io, Socket } from "socket.io-client";
import * as monacoEditor from "monaco-editor";
import { useSearchParams } from "next/navigation";

// Update the socket URL to match your Glitch server
const SOCKET_URL = "https://codecolab-wsserver.glitch.me";

interface User {
  id: string;
  name: string;
  joinedAt: Date;
}

interface TextAreaProps {
  roomId: string;
  value?: string;
  onChange?: (value: string) => void;
  onUsersUpdate?: (users: User[]) => void;
  socket?: Socket | null;
}

interface CursorPosition {
  userId: string;
  userName: string;
  position: {
    lineNumber: number;
    column: number;
  };
}

const TextArea: React.FC<TextAreaProps> = ({
  roomId,
  value,
  onChange,
  onUsersUpdate,
  socket: externalSocket,
}) => {
  const searchParams = useSearchParams();
  const userName = searchParams.get("name") || "Anonymous";
  const [code, setCode] = useState<string>(value || "");
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const isUpdatingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Update socket connection logic
  useEffect(() => {
    if (externalSocket) {
      socketRef.current = externalSocket;
      setConnected(true);
      return;
    }

    // Initialize socket connection with better error handling
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ["websocket", "polling"], // Allow fallback to polling
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to server");
      setConnected(true);
      // Join the room after connection
      socket.emit("join-room", { roomId, userName });
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnected(false);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, userName, externalSocket]);

  // Handle socket events
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    socket.on("initial-code", (initialCode: string) => {
      if (initialCode && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          isUpdatingRef.current = true;
          model.setValue(initialCode);
          setCode(initialCode);
          if (onChange) onChange(initialCode);
          isUpdatingRef.current = false;
        }
      }
    });

    socket.on("code-update", (newCode: string) => {
      if (editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          isUpdatingRef.current = true;
          const position = editorRef.current.getPosition();

          model.setValue(newCode);
          setCode(newCode);
          if (onChange) onChange(newCode);

          if (position) {
            editorRef.current.setPosition(position);
          }
          isUpdatingRef.current = false;
        }
      }
    });

    // Handle user join/leave events
    socket.on("user-joined", ({ userCount: count }) => {
      setUserCount(count);
    });

    socket.on("user-left", ({ userCount: count }) => {
      setUserCount(count);
    });

    // Handle users list updates
    socket.on("users-update", (users: User[]) => {
      setConnectedUsers(users);
      if (onUsersUpdate) {
        onUsersUpdate(users);
      }
    });

    // Handle cursor updates from other users
    socket.on(
      "cursor-moved",
      ({ userId, userName, position }: CursorPosition) => {
        if (editorRef.current && monacoRef.current) {
          const editor = editorRef.current;
          const monaco = monacoRef.current;

          // Clear old decorations
          if (decorationsRef.current.length) {
            editor.deltaDecorations(decorationsRef.current, []);
          }

          // Add new decoration
          decorationsRef.current = editor.deltaDecorations(
            [],
            [
              {
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column + 1
                ),
                options: {
                  className: "remote-cursor",
                  hoverMessage: { value: `${userName}` },
                },
              },
            ]
          );
        }
      }
    );

    return () => {
      socket.off("initial-code");
      socket.off("code-update");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("users-update");
      socket.off("cursor-moved");
    };
  }, [onChange]);

  // Handle editor mounting
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (value) {
      const model = editor.getModel();
      if (model) {
        model.setValue(value);
      }
    }

    editor.onDidChangeModelContent((e) => {
      if (!isUpdatingRef.current) {
        const newValue = editor.getValue();

        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
          setCode(newValue);
          if (onChange) onChange(newValue);
          socketRef.current?.emit("code-change", {
            roomId,
            code: newValue,
          });
        }, 100);
      }
    });

    editor.onDidChangeCursorPosition((e) => {
      socketRef.current?.emit("cursor-update", {
        roomId,
        position: {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        },
      });
    });
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 bg-gray-800 text-white px-2 py-1 rounded">
        {connected
          ? `${userCount} user${userCount !== 1 ? "s" : ""} connected`
          : "Connecting..."}
      </div>
      <Editor
        value={code}
        onMount={handleEditorDidMount}
        height="100%"
        width="100%"
        theme="vs-dark"
        defaultLanguage="javascript"
        options={{
          wordWrap: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
};

export default TextArea;
