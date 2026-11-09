import { useState } from "react";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "エラー";
  return String(Math.round(n * 1e10) / 1e10);
}

/** A normal calculator. `onResult` gets each "=" result (used for the secret open codes). */
export function Calculator({ onResult }: { onResult?: (result: string) => void }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const calc = (a: number, b: number, o: string) =>
    o === "+" ? a + b : o === "−" ? a - b : o === "×" ? a * b : o === "÷" ? a / b : b;

  function digit(d: string) {
    if (d === "." && !fresh && display.includes(".")) return;
    if (fresh) {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
    } else setDisplay(display === "0" && d !== "." ? d : display + d);
  }
  function operator(o: string) {
    const cur = parseFloat(display);
    if (acc !== null && op && !fresh) {
      const r = calc(acc, cur, op);
      setAcc(r);
      setDisplay(fmt(r));
    } else setAcc(cur);
    setOp(o);
    setFresh(true);
  }
  function equals() {
    const cur = parseFloat(display);
    const r = acc !== null && op ? calc(acc, cur, op) : cur;
    const s = fmt(r);
    setDisplay(s);
    setAcc(null);
    setOp(null);
    setFresh(true);
    onResult?.(s);
  }
  function key(k: string) {
    if (/^[0-9.]$/.test(k)) digit(k);
    else if (k === "C") {
      setDisplay("0");
      setAcc(null);
      setOp(null);
      setFresh(true);
    } else if (k === "±") setDisplay(fmt(-parseFloat(display)));
    else if (k === "%") setDisplay(fmt(parseFloat(display) / 100));
    else if (k === "=") equals();
    else operator(k);
  }

  const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];
  return (
    <div className="mx-auto w-full max-w-xs rounded-3xl bg-card p-4 shadow-xl ring-1 ring-border">
      <div className="mb-3 overflow-x-auto rounded-2xl bg-muted px-4 py-5 text-right font-mono text-4xl font-bold text-foreground tabular-nums">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => key(k)}
            className={`h-14 rounded-2xl text-xl font-semibold transition active:scale-95 ${
              k === "0" ? "col-span-2" : ""
            } ${
              ["÷", "×", "−", "+", "="].includes(k)
                ? "bg-primary text-primary-foreground"
                : ["C", "±", "%"].includes(k)
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
