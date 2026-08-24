"use client";

import { useState } from "react";
import { MODULES, ACTIONS, MODULE_LABELS, ACTION_LABELS, permKey } from "@/lib/auth/permissions";

export function PermissionMatrix({ name, defaultKeys = [] }: { name: string; defaultKeys?: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultKeys));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(module: string, keys: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
            <th className="px-4 py-2.5 font-medium">Módulo</th>
            {ACTIONS.map((a) => (
              <th key={a} className="px-3 py-2.5 text-center font-medium">
                {ACTION_LABELS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((module) => {
            const keys = ACTIONS.map((a) => permKey(module, a));
            return (
              <tr key={module} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-text-primary">
                  <button type="button" className="text-left hover:text-accent" onClick={() => toggleModule(module, keys)}>
                    {MODULE_LABELS[module]}
                  </button>
                </td>
                {ACTIONS.map((action) => {
                  const key = permKey(module, action);
                  return (
                    <td key={key} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        name={name}
                        value={key}
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                        className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]"
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
