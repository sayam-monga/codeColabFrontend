import { EditorLayout } from "@/components/resizeable";
import { redirect } from "next/navigation";

export default function EditorPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams: { name?: string };
}) {
  const roomId = params.roomId;
  const userName = searchParams.name;

  if (!userName) {
    redirect("/");
  }

  return (
    <div className="h-screen">
      <EditorLayout roomId={roomId} userName={userName} />
    </div>
  );
}
