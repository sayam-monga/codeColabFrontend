"use client";
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { FloatingDock } from "./ui/floating-dock";
import {
  IconPencil,
  IconEraser,
  IconSquare,
  IconCircle,
  IconLine,
  IconColorPicker,
  IconTrash,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Socket } from "socket.io-client";

// Function to generate a consistent color for a user based on their username
const generateUserColor = (username: string): string => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`; // Using HSL for better visibility
};

interface DrawingBoardProps {
  roomId: string;
  userName: string;
  socket?: Socket | null;
}

type Tool = "pen" | "eraser" | "rectangle" | "circle" | "line";
type DrawingData = {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  userId: string;
  userName: string;
};

type ToolState = {
  activeTool: Tool;
  color: string;
  width: number;
};

interface UserPointerMove {
  userId: string;
  userName: string;
  position: { x: number; y: number };
}

interface ConnectedUser {
  x: number;
  y: number;
  name: string;
  isDrawing: boolean;
  color: string;
}

const DrawingBoard: React.FC<DrawingBoardProps> = ({
  roomId,
  userName,
  socket: externalSocket,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toolState, setToolState] = useState<ToolState>({
    activeTool: "pen",
    color: "#FFFFFF",
    width: 2,
  });
  const [tempDrawing, setTempDrawing] = useState<DrawingData | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<
    Map<string, ConnectedUser>
  >(new Map());
  const [drawings, setDrawings] = useState<DrawingData[]>([]);
  const userColorRef = useRef<string>(generateUserColor(userName));
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Update userColorRef when userName changes
  useEffect(() => {
    if (userName) {
      userColorRef.current = generateUserColor(userName);
    }
  }, [userName]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setDrawings([]);
    socketRef.current?.emit("clear-canvas", { roomId });
  };

  // Canvas setup and resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;

      // Set the canvas size in pixels
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Set the display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;

      // Scale all drawing operations
      context.scale(dpr, dpr);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = userColorRef.current;
      context.lineWidth = toolState.width;
      contextRef.current = context;

      redrawCanvas(drawings);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [drawings, toolState.width]);

  const getCanvasPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Add smoothing function
  const getSmoothPoints = (
    points: { x: number; y: number }[],
    tension = 0.5
  ) => {
    if (points.length < 2) return points;

    const controlPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;

      controlPoints.push({
        x: curr.x + dx * tension,
        y: curr.y + dy * tension,
      });

      controlPoints.push({
        x: next.x - dx * tension,
        y: next.y - dy * tension,
      });
    }

    return controlPoints;
  };

  const drawPoints = () => {
    if (!contextRef.current || pointsRef.current.length < 2) return;

    const context = contextRef.current;
    const points = pointsRef.current;
    const smoothPoints = getSmoothPoints(points);

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < smoothPoints.length - 1; i += 2) {
      const cp1 = smoothPoints[i];
      const cp2 = smoothPoints[i + 1];
      const end = points[Math.floor(i / 2) + 1];

      context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    }

    context.strokeStyle = userColorRef.current;
    context.stroke();
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !contextRef.current || !startPoint.current) return;

    const canvas = canvasRef.current;
    const point = getCanvasPoint(e);
    if (!point || !canvas) return;

    const context = contextRef.current;
    const { x, y } = point;
    const now = Date.now();

    if (toolState.activeTool === "pen") {
      // Throttle points collection for smoother curves
      if (now - lastTimeRef.current > 16) {
        // ~60fps
        pointsRef.current.push({ x, y });
        lastTimeRef.current = now;

        // Clear previous drawing
        const dpr = window.devicePixelRatio;
        context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        redrawCanvas(drawings);

        // Draw current stroke
        drawPoints();

        // If we have enough points, emit the drawing
        if (pointsRef.current.length >= 2) {
          const points = pointsRef.current;
          const drawingData: DrawingData = {
            tool: toolState.activeTool,
            color: userColorRef.current,
            width: toolState.width,
            points: [points[points.length - 2], points[points.length - 1]],
            userId: socketRef.current?.id || "",
            userName,
          };

          setDrawings((prev) => [...prev, drawingData]);
          socketRef.current?.emit("draw", { roomId, drawingData });
        }
      }
    } else if (toolState.activeTool === "eraser") {
      context.save();
      context.globalCompositeOperation = "destination-out";
      context.beginPath();
      context.arc(x, y, toolState.width * 5, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const drawingData: DrawingData = {
        tool: toolState.activeTool,
        color: "transparent",
        width: toolState.width * 5,
        points: [{ x, y }],
        userId: socketRef.current?.id || "",
        userName,
      };

      // Add to local drawings array
      setDrawings((prev) => [...prev, drawingData]);
      socketRef.current?.emit("draw", { roomId, drawingData });
      startPoint.current = { x, y };
    } else {
      // For shape tools
      const dpr = window.devicePixelRatio;
      context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      redrawCanvas(drawings);

      context.beginPath();
      context.strokeStyle = userColorRef.current;
      context.lineWidth = toolState.width;

      const drawingData: DrawingData = {
        tool: toolState.activeTool,
        color: userColorRef.current,
        width: toolState.width,
        points: [startPoint.current, { x, y }],
        userId: socketRef.current?.id || "",
        userName,
      };

      drawShape(context, drawingData);
      setTempDrawing(drawingData);
    }
  };

  const drawShape = (context: CanvasRenderingContext2D, data: DrawingData) => {
    const [start, end] = data.points;

    if (data.tool === "rectangle") {
      const width = end.x - start.x;
      const height = end.y - start.y;
      context.strokeRect(start.x, start.y, width, height);
    } else if (data.tool === "circle") {
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      context.beginPath();
      context.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      context.stroke();
    } else if (data.tool === "line") {
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  };

  const drawFromStream = (data: DrawingData) => {
    const context = contextRef.current;
    if (!context || !canvasRef.current) return;

    if (data.tool === "eraser") {
      context.save();
      context.globalCompositeOperation = "destination-out";
      const [point] = data.points;
      context.beginPath();
      context.arc(point.x, point.y, data.width, 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else {
      context.beginPath();
      context.strokeStyle = data.color;
      context.lineWidth = data.width;

      if (data.points.length > 0) {
        const [start, end] = data.points;
        if (data.tool === "pen") {
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        } else {
          drawShape(context, data);
        }
      }
    }
  };

  const redrawCanvas = (drawings: DrawingData[] = []) => {
    const context = contextRef.current;
    if (!context || !canvasRef.current) return;

    const dpr = window.devicePixelRatio;
    context.clearRect(
      0,
      0,
      canvasRef.current.width / dpr,
      canvasRef.current.height / dpr
    );

    drawings.forEach((drawing) => {
      context.save();
      context.strokeStyle = drawing.color;
      context.lineWidth = drawing.width;

      if (drawing.tool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        const [point] = drawing.points;
        if (point) {
          context.beginPath();
          context.arc(point.x, point.y, drawing.width * 5, 0, Math.PI * 2);
          context.fill();
        }
      } else if (drawing.tool === "pen") {
        if (drawing.points.length >= 2) {
          const [start, end] = drawing.points;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
      } else {
        if (drawing.points.length >= 2) {
          drawShape(context, drawing);
        }
      }
      context.restore();
    });
  };

  const tools = [
    {
      title: "Pen",
      icon: (
        <IconPencil
          className={cn(
            "text-white",
            toolState.activeTool === "pen" && "text-sky-400"
          )}
        />
      ),
      onClick: () => setToolState({ ...toolState, activeTool: "pen" }),
      isActive: toolState.activeTool === "pen",
    },
    {
      title: "Eraser",
      icon: (
        <IconEraser
          className={cn(
            "text-white",
            toolState.activeTool === "eraser" && "text-sky-400"
          )}
        />
      ),
      onClick: () => setToolState({ ...toolState, activeTool: "eraser" }),
      isActive: toolState.activeTool === "eraser",
    },
    {
      title: "Rectangle",
      icon: (
        <IconSquare
          className={cn(
            "text-white",
            toolState.activeTool === "rectangle" && "text-sky-400"
          )}
        />
      ),
      onClick: () => setToolState({ ...toolState, activeTool: "rectangle" }),
      isActive: toolState.activeTool === "rectangle",
    },
    {
      title: "Circle",
      icon: (
        <IconCircle
          className={cn(
            "text-white",
            toolState.activeTool === "circle" && "text-sky-400"
          )}
        />
      ),
      onClick: () => setToolState({ ...toolState, activeTool: "circle" }),
      isActive: toolState.activeTool === "circle",
    },
    {
      title: "Line",
      icon: (
        <IconLine
          className={cn(
            "text-white",
            toolState.activeTool === "line" && "text-sky-400"
          )}
        />
      ),
      onClick: () => setToolState({ ...toolState, activeTool: "line" }),
      isActive: toolState.activeTool === "line",
    },
    {
      title: "Color",
      icon: (
        <div className="relative">
          <IconColorPicker className="text-white" />
          <div
            className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: toolState.color }}
          />
        </div>
      ),
      onClick: () => document.getElementById("colorPicker")?.click(),
    },
    {
      title: "Clear",
      icon: <IconTrash className="text-white hover:text-red-400" />,
      onClick: clearCanvas,
    },
  ];

  const startDrawing = (e: React.PointerEvent) => {
    const point = getCanvasPoint(e);
    if (!point || !contextRef.current) return;

    setIsDrawing(true);
    startPoint.current = point;
    pointsRef.current = [point];
    lastTimeRef.current = Date.now();
    setTempDrawing(null);

    // Emit initial drawing state
    socketRef.current?.emit("pointer-move", {
      roomId,
      position: {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      },
      userId: socketRef.current.id,
      userName,
      isDrawing: true,
      userColor: userColorRef.current,
    });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    // Clear points array
    const points = pointsRef.current;
    pointsRef.current = [];

    if (toolState.activeTool === "pen" && points.length >= 2) {
      const drawingData: DrawingData = {
        tool: toolState.activeTool,
        color: userColorRef.current,
        width: toolState.width,
        points: [points[points.length - 2], points[points.length - 1]],
        userId: socketRef.current?.id || "",
        userName,
      };

      socketRef.current?.emit("draw", { roomId, drawingData });
      setDrawings((prev) => [...prev, drawingData]);
    } else if (tempDrawing && tempDrawing.points.length >= 2) {
      socketRef.current?.emit("draw", { roomId, drawingData: tempDrawing });
      setDrawings((prev) => [...prev, tempDrawing]);
    }

    setIsDrawing(false);
    startPoint.current = null;
    setTempDrawing(null);

    // Emit final drawing state
    socketRef.current?.emit("pointer-move", {
      roomId,
      position: { x: 0, y: 0 },
      userId: socketRef.current.id,
      userName,
      isDrawing: false,
      userColor: userColorRef.current,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasPoint(e);
    if (!point) return;

    socketRef.current?.emit("pointer-move", {
      roomId,
      position: {
        x: point.x * 100, // Convert to percentage
        y: point.y * 100,
      },
      userId: socketRef.current.id,
      userName,
      isDrawing,
    });
  };

  // Socket connection and event handling
  useEffect(() => {
    if (externalSocket) {
      socketRef.current = externalSocket;
      console.log("Connected to drawing server");
      externalSocket.emit("join-drawing", {
        roomId,
        userName,
        userColor: userColorRef.current,
      });
      return;
    }

    // Initialize socket connection
    socketRef.current = io("https://codecolab-drawserver.glitch.me", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to drawing server");
      socket.emit("join-drawing", {
        roomId,
        userName,
        userColor: userColorRef.current,
      });
    });

    socket.on("connect_error", (error: Error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from drawing server");
      setConnectedUsers(new Map());
    });

    socket.on(
      "initial-state",
      (data: { drawings: DrawingData[]; toolState: ToolState }) => {
        if (data.toolState) {
          setToolState((prev) => ({
            ...prev,
            activeTool: data.toolState.activeTool,
            width: data.toolState.width,
          }));
        }
        // Set drawings and redraw in one go to prevent flicker
        setDrawings(data.drawings);
        requestAnimationFrame(() => {
          redrawCanvas(data.drawings);
        });
      }
    );

    socket.on("drawing-data", (data: DrawingData) => {
      // Update drawings array and redraw
      setDrawings((prev) => {
        const newDrawings = [...prev, data];
        requestAnimationFrame(() => {
          redrawCanvas(newDrawings);
        });
        return newDrawings;
      });
    });

    socket.on("tool-state-update", (newToolState: ToolState) => {
      setToolState((prev) => ({
        ...prev,
        activeTool: newToolState.activeTool,
        width: newToolState.width,
      }));
    });

    socket.on(
      "user-pointer-move",
      ({
        userId,
        userName,
        position,
        isDrawing,
        userColor,
      }: UserPointerMove & { isDrawing: boolean; userColor: string }) => {
        setConnectedUsers((prev) => {
          const next = new Map(prev);
          next.set(userId, {
            x: position.x,
            y: position.y,
            name: userName,
            isDrawing,
            color: userColor,
          });
          return next;
        });
      }
    );

    socket.on("clear-canvas", () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      setDrawings([]);
    });

    socket.on("user-left", (userId: string) => {
      setConnectedUsers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      if (socket && !externalSocket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, userName, externalSocket]);

  const updateToolState = (newState: ToolState) => {
    setToolState(newState);
    if (contextRef.current) {
      contextRef.current.strokeStyle = newState.color;
      contextRef.current.lineWidth = newState.width;
    }
    socketRef.current?.emit("tool-state-update", {
      roomId,
      toolState: newState,
    });
  };

  return (
    <div className="h-full w-full bg-neutral-900 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-neutral-900"
        onPointerDown={startDrawing}
        onPointerMove={(e) => {
          if (isDrawing) draw(e);
        }}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        style={{ touchAction: "none", cursor: "crosshair" }}
      />

      {/* Remote user pointers */}
      {Array.from(connectedUsers).map(
        ([userId, user]) =>
          userId !== socketRef.current?.id && (
            <div
              key={userId}
              className="absolute pointer-events-none"
              style={{
                left: `${user.x}%`,
                top: `${user.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 50,
              }}
            >
              <div className="px-2 py-1 rounded bg-neutral-800 text-white text-sm flex items-center gap-2">
                <span>{user.name}</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                {user.isDrawing && (
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
            </div>
          )
      )}

      {/* Tools dock at the bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <FloatingDock items={tools} />
        <input
          id="colorPicker"
          type="color"
          className="hidden"
          defaultValue={toolState.color}
          onChange={(e) => {
            const newColor = e.target.value;
            updateToolState({ ...toolState, color: newColor });
          }}
        />
      </div>
    </div>
  );
};

export default DrawingBoard;
