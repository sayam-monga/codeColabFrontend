import Hero from "@/components/hero";
import { ScrollArea } from "@/components/ui/scroll-area";
import JoinForm from "@/components/form";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { AuroraBackground } from "@/components/ui/aurora-background";
import FlickeringGrid from "@/components/ui/flickering-grid";
export default function Home() {
  return (
    <div className="container flex flex-row">
      <div className="Hero w-2/3 h-screen hidden sm:block">
        <Hero />
        {/* </ScrollArea> */}
      </div>

      <div className="Form relative flex justify-center items-center w-full sm:w-1/3 h-screen">
        <div className="absolute inset-0 overflow-hidden">
          <FlickeringGrid
            className="z-0 absolute inset-0 size-full"
            squareSize={4}
            gridGap={6}
            color="#6B7280"
            maxOpacity={0.5}
            flickerChance={0.1}
            height={800}
            width={800}
          />
        </div>
        <div className="relative z-10">
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
