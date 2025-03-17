"use client";
import React, { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import TextArea from "./textEditor";
import { FloatingDock } from "./ui/floating-dock";
import { IconCopy, IconUser, IconXboxXFilled } from "@tabler/icons-react";
import { FloatingList } from "./ui/floating-list";
import XTerminal from "./terminal";
import { useToast } from "@/components/ui/use-toast";
import DrawingBoard from "../components/DrawingBoard";

interface User {
  id: string;
  name: string;
  joinedAt: Date;
}

interface EditorLayoutProps {
  roomId: string;
  userName: string;
}

export function EditorLayout({ roomId, userName }: EditorLayoutProps) {
  const [code, setCode] = useState("");
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const { toast } = useToast();

  // Links for various actions
  const links = [
    {
      title: "End Session",
      icon: (
        <IconXboxXFilled className="h-full w-full text-red-500 dark:text-red-500" />
      ),
      onClick: () => handleAction("End"),
    },
    {
      title: "Copy Session ID",
      icon: (
        <IconCopy className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      onClick: () => handleAction("Copy"),
    },
  ];

  const link2 = [
    {
      title: "Connected Members",
      icon: (
        <IconUser className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      onClick: () => handleAction("Members"),
    },
  ];

  // Generalized action handler
  const handleAction = async (action: string) => {
    if (action === "Copy") {
      try {
        await navigator.clipboard.writeText(roomId);
        toast({
          title: "Copied!",
          description: "Room ID has been copied to clipboard",
          duration: 2000,
        });
      } catch (err) {
        toast({
          title: "Failed to copy",
          description: "Please try copying manually",
          variant: "destructive",
          duration: 2000,
        });
      }
    } else if (action === "End") {
      window.location.href = "/";
    }
  };

  // Handle code updates
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // Handle users updates
  const handleUsersUpdate = (users: User[]) => {
    setConnectedUsers(users);
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="max-w-screen min-h-screen bg-black"
    >
      <ResizablePanel defaultSize={50} minSize={30} maxSize={60}>
        <div className="relative flex h-full items-center justify-center">
          <TextArea
            roomId={roomId}
            value={code}
            onChange={handleCodeChange}
            onUsersUpdate={handleUsersUpdate}
          />
          <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex flex-row">
              <FloatingDock items={links} />
              <div className="ml-2">
                <FloatingList items={link2} connectedUsers={connectedUsers} />
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={50} minSize={40} maxSize={60}>
            <XTerminal />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={30} maxSize={60}>
            <div className="h-full w-full">
              <DrawingBoard roomId={roomId} userName={userName} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
