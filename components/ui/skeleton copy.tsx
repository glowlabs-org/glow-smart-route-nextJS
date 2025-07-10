import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-glow-medium-grey animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
