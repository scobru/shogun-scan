import { cn } from "@/lib/utils"
import { ButtonHTMLAttributes } from "react"

interface LinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: string
  className?: string
}

const Link = ({ text, className, ...props }: LinkProps) => {
  return (
    <button
      className={cn(
        "text-sm text-primary hover:underline cursor-pointer w-full text-center",
        className
      )}
      {...props}
    >
      {text}
    </button>
  )
}

export default Link 