import { ArrowRight, Link2, ShieldCheck, Upload, X } from "lucide-react";

export type SourceMode = "url" | "local";

interface AddSourceDialogProps {
  mode: SourceMode;
  setMode: (mode: SourceMode) => void;
  value: string;
  setValue: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
}

export function AddSourceDialog({ mode, setMode, value, setValue, onClose, onAdd }: AddSourceDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="source-dialog" role="dialog" aria-modal="true" aria-labelledby="add-source-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <div><p className="eyebrow">Source ingestion</p><h2 id="add-source-title">Add to the foundry</h2></div>
          <button className="icon-button" title="Close" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="mode-switch">
          <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}><Link2 size={15} /> Online source</button>
          <button className={mode === "local" ? "active" : ""} onClick={() => setMode("local")}><Upload size={15} /> Local file</button>
        </div>
        <label className="dialog-field">
          <span>{mode === "url" ? "Source URL" : "Local file path"}</span>
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={mode === "url" ? "https://example.org/paper" : "/Users/you/Documents/source.pdf"} />
        </label>
        <div className="ingestion-note">
          <ShieldCheck size={17} />
          <p><strong>Nothing activates automatically.</strong><span>The source will be captured, checked, and processed into inspectable proposals.</span></p>
        </div>
        <button className="primary-button full" onClick={onAdd} disabled={!value.trim()}>Capture source <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}
