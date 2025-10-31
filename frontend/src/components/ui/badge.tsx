import * as React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children?: React.ReactNode;
}

const badgeVariants = {
  default: "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
  secondary: "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-100/80",
  destructive: "border-transparent bg-red-600 text-white hover:bg-red-600/80",
  outline: "text-gray-900 border-gray-300",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          badgeVariants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, type BadgeProps };