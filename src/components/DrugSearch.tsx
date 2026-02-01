import { useEffect, useId, useRef, useState } from "react";

import { suggest } from "../lib/api";

/** A combobox with RxNorm suggestions. Enter adds what's typed even without picking. */
export function DrugSearch({ onAdd }: { onAdd: (name: string) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (text.trim().length < 2) return setOptions([]);
    const controller = new AbortController();
    // Wait for a pause in typing so each keystroke isn't a request.
    timer.current = window.setTimeout(() => {
      suggest(text, controller.signal)
        .then((names) => {
          setOptions(names);
          setActive(-1);
        })
        .catch(() => setOptions([]));
    }, 250);
    return () => {
      window.clearTimeout(timer.current);
      controller.abort();
    };
  }, [text]);

  const add = (name: string) => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setText("");
    setOptions([]);
    setActive(-1);
  };

  return (
    <div className="search">
      <label htmlFor={`${listId}-input`}>Add a medication</label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Brand or generic name, e.g. Advil or warfarin"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            // Only a highlighted, still-listed suggestion wins over what's typed.
            add(options[active] ?? text);
          } else if (e.key === "Escape") {
            setOptions([]);
          }
        }}
      />
      {options.length > 0 && (
        <ul id={listId} role="listbox" className="options">
          {options.map((o, i) => (
            <li
              key={o}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the input
                add(o);
              }}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
