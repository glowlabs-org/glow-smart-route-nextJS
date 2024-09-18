import clsx from "clsx";
import { Loader2 } from "lucide-react";

export default function Loading({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "flex flex-1 justify-center items-center h-screen bg-white",
        className
      )}
    >
      <Loader2 className="w-[100px] h-[100px] mx-auto animate-spin text-secondary" />
    </div>
  );
}
