"use client";

import { Delete } from "lucide-react";

interface NumericKeypadProps {
  onKey: (key: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onEnter?: () => void;
}

export default function NumericKeypad({
  onKey,
  onClear,
  onBackspace,
  onEnter,
}: NumericKeypadProps) {
  const baseBtn =
    "flex items-center justify-center h-11 sm:h-12 md:h-12 lg:h-13 xl:h-14 rounded-lg font-semibold text-base sm:text-lg md:text-xl transition-all active:scale-95 select-none shadow-xs";

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full">
      <button
        onClick={() => onKey("7")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        7
      </button>
      <button
        onClick={() => onKey("8")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        8
      </button>
      <button
        onClick={() => onKey("9")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        9
      </button>
      <button
        onClick={onClear}
        className={`${baseBtn} bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200/60`}
      >
        C
      </button>

      <button
        onClick={() => onKey("4")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        4
      </button>
      <button
        onClick={() => onKey("5")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        5
      </button>
      <button
        onClick={() => onKey("6")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        6
      </button>
      <button
        onClick={onBackspace}
        className={`${baseBtn} bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-200/60`}
      >
        <Delete className="h-5 w-5" />
      </button>

      <button
        onClick={() => onKey("1")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        1
      </button>
      <button
        onClick={() => onKey("2")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        2
      </button>
      <button
        onClick={() => onKey("3")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        3
      </button>
      <div className="row-span-2">
        <button
          onClick={() => onEnter && onEnter()}
          className={`${baseBtn} h-full bg-minia-primary/90 hover:bg-minia-primary text-white border border-minia-primary`}
        >
          Enter
        </button>
      </div>

      <button
        onClick={() => onKey("0")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        0
      </button>
      <button
        onClick={() => onKey("00")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        00
      </button>
      <button
        onClick={() => onKey(".")}
        className={`${baseBtn} bg-muted/50 hover:bg-muted text-foreground border border-border`}
      >
        .
      </button>
    </div>
  );
}
