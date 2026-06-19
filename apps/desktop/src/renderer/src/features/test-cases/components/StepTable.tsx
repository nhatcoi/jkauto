import type { KeywordMeta, Platform } from "@jkauto/core";
import type { StepStatus } from "@/store/run.store";
import { getKeyword } from "../keywords";
import { StepRow } from "./StepRow";
import type { ObjectEntry } from "../hooks/useObjectItems";
import type { TestStep } from "../types";

interface Props {
  steps: TestStep[];
  keywords: KeywordMeta[];
  platform?: Platform;
  objectItems: ObjectEntry[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onChange: (idx: number, patch: Partial<TestStep>) => void;
  onDelete: (idx: number) => void;
  stepStatuses: Record<number, StepStatus>;
  stepMessages: Record<number, string>;
  dragOverIdx: number | null;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnter: (index: number) => void;
  onDragLeave: () => void;
  onContextMenu: (e: React.MouseEvent, index: number) => void;
}

export function StepTable({
  steps,
  keywords,
  platform,
  objectItems,
  selectedIdx,
  onSelect,
  onChange,
  onDelete,
  stepStatuses,
  stepMessages,
  dragOverIdx,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onDragEnter,
  onDragLeave,
  onContextMenu,
}: Props) {
  const sel = selectedIdx !== null ? steps[selectedIdx] : null;

  return (
    <>
      {/* ── table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30 sticky top-0 z-10">
              <th className="w-12 px-1 py-1.5" />
              <th className="w-7 px-1" />
              <th className="w-40 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Keyword
              </th>
              <th className="text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                Description
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                {platform === 'api' ? 'Object / Path' : 'Object / Selector'}
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                {platform === 'api' ? 'URL / Value' : 'Input'}
              </th>
              <th className="w-36 text-[10px] font-medium text-muted-foreground text-left px-1 py-1.5">
                {platform === 'api' ? 'Body / Expected' : 'Expected'}
              </th>
              <th className="w-8 px-1" />
            </tr>
          </thead>
          <tbody>
            {steps.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-xs text-muted-foreground/50 py-12"
                >
                  No steps yet. Click <strong>Add Step</strong> to get started.
                </td>
              </tr>
            )}
            {steps.map((step, idx) => (
              <StepRow
                key={step.id}
                step={step}
                index={idx}
                selected={selectedIdx === idx}
                onSelect={() => onSelect(idx)}
                onChange={(patch) => onChange(idx, patch)}
                onDelete={() => onDelete(idx)}
                kw={getKeyword(keywords, step.keyword)}
                platform={platform}
                objectItems={objectItems}
                stepStatus={stepStatuses[idx]}
                stepMessage={stepMessages[idx]}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                isDragOver={dragOverIdx === idx}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onContextMenu={onContextMenu}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── step detail (continue-on-failure, timeout) ── */}
      {sel && selectedIdx !== null && (
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground/60">
            Step {selectedIdx + 1}
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sel.continueOnFailure}
              onChange={(e) =>
                onChange(selectedIdx, { continueOnFailure: e.target.checked })
              }
              className="w-3 h-3 accent-primary"
            />
            Continue on failure
          </label>
          <label className="flex items-center gap-1.5">
            Timeout (ms):
            <input
              type="number"
              value={sel.timeout ?? ""}
              placeholder="default"
              onChange={(e) =>
                onChange(selectedIdx, {
                  timeout: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 bg-input text-foreground text-xs px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none"
            />
          </label>
        </div>
      )}
    </>
  );
}
