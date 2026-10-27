import { useRef } from "react";

interface ToolbarProps {
  projectName: string;
  previewing: boolean;
  validationOpen: boolean;
  validationCount: number;
  saveStatus: string;
  feedback: string;
  onProjectNameChange: (name: string) => void;
  onPreviewToggle: () => void;
  onValidationToggle: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onReset: () => void;
}

export function Toolbar({ projectName, previewing, validationOpen, validationCount, saveStatus, feedback, onProjectNameChange, onPreviewToggle, onValidationToggle, onExport, onImportFile, onReset }: ToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <header className="studio-toolbar">
      <a className="studio-brand" href="/" aria-label="Scrol-a-Vision homepage">
        Scrol<span>-a-</span>Vision <small>STUDIO</small>
      </a>
      <div className="toolbar-project">
        <span className="toolbar-label">PROJECT</span>
        <input
          aria-label="Project name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
        />
      </div>
      <div className="toolbar-actions">
        <button type="button" className="quiet-button" disabled title="Undo is not available in this prototype">Undo</button>
        <button type="button" className="quiet-button" disabled title="Redo is not available in this prototype">Redo</button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button type="button" className="quiet-button review-toggle" onClick={onValidationToggle} aria-expanded={validationOpen} aria-label={validationOpen ? "Close validation review" : `Open validation review, ${validationCount} findings`}>
          {validationOpen ? "Close review" : `Review · ${validationCount}`}
        </button>
        <span className="save-status" aria-live="polite" title={saveStatus}>{saveStatus}</span>
        <button type="button" className="quiet-button file-action" aria-label="Export JSON" onClick={onExport}><span className="full-action-label">Export JSON</span><span className="compact-action-label">Export</span></button>
        <button type="button" className="quiet-button file-action" aria-label="Import JSON" onClick={() => fileInput.current?.click()}><span className="full-action-label">Import JSON</span><span className="compact-action-label">Import</span></button>
        <input
          ref={fileInput}
          className="file-input"
          type="file"
          accept=".json,application/json"
          aria-label="Import story JSON file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onImportFile(file);
            event.currentTarget.value = "";
          }}
        />
        <button type="button" className="quiet-button file-action" aria-label="Reset sample" onClick={onReset}><span className="full-action-label">Reset sample</span><span className="compact-action-label">Reset</span></button>
        <span className="toolbar-divider" aria-hidden="true" />
        <a className="quiet-button file-action player-link" href="/player/?frame=1080x1920" aria-label="Play story"><span className="full-action-label">Play story</span><span className="compact-action-label">Play</span></a>
        <button type="button" className="preview-button" onClick={onPreviewToggle} aria-pressed={previewing} aria-label={previewing ? "Edit shot" : "Preview shot"}>
          <span className="full-action-label">{previewing ? "Edit shot" : "Preview shot"}</span>
          <span className="compact-action-label">{previewing ? "Edit" : "Preview"}</span>
        </button>
      </div>
      {feedback && <div className="toolbar-feedback" role={feedback.startsWith("Import failed") ? "alert" : "status"}>{feedback}</div>}
    </header>
  );
}