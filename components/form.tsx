"use client";
import { FlipWords } from "../components/ui/flip-words";
import { CardSpotlight } from "./ui/card-spotlight";
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Users, LogIn } from "lucide-react";
import { IconLogin, IconUser, IconUsers } from "@tabler/icons-react";
import SignupForm from "./example/signup-form-demo";
export default function JoinForm() {
  return (
    <div className="flex flex-col   justify-center">
      {/* <CardSpotlight className="h-screen w-full "> */}
      <SignupForm />
      {/* </CardSpotlight> */}
    </div>
  );
}
