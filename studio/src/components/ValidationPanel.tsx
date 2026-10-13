import { useState } from "react";
import type { StoryValidationReport, ValidationCategory, StoryDiagnostic } from "../data/storyValidation";

interface ValidationPanelProps {
  report: StoryValidationReport;
  onClose: () => void;
  onSelectObject: (objectId?: string) => void;
}

const categories: { id: ValidationCategory; label: string }[] = [
  { id: "structural", label: "Structural" },
  { id: "playback", label: "Playback" },
  { id: "editorial", label: "Editorial" },
];

function categoryFindings(report: StoryValidationReport, category: ValidationCategory): StoryDiagnostic[] {
  return report[category];
}

export function ValidationPanel({ report, onClose, onSelectObject }: ValidationPanelProps) {
  const [activeCategory, setActiveCategory] = useState<ValidationCategory>("structural");
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const findings = categoryFindings(report, activeCategory);

  return (
    <section className="validation-panel" aria-label="Story validation review">
      <div className="validation-panel-heading">
        <div>
          <span className="eyebrow">DRAFT REVIEW</span>
          <h2>Validation</h2>
        </div>
        <div className={`validation-readiness${report.publicationReady ? " is-ready" : " is-blocked"}`}>
          {report.publicationReady ? "No publication blockers found" : "Publication readiness blocked"}
          <small>{report.draftSavable ? "Draft remains saveable" : "Schema invalid; draft cannot be serialized"}</small>
        </div>
        <button type="button" className="validation-close" aria-label="Close validation review" onClick={onClose}>×</button>
      </div>
      <div className="validation-tabs" role="tablist" aria-label="Validation categories">
        {categories.map((category) => {
          const count = report[category.id].length;
          return (
            <button
              type="button"
              role="tab"
              id={`validation-tab-${category.id}`}
              aria-selected={activeCategory === category.id}
              aria-controls="validation-findings"
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}<span>{count}</span>
            </button>
          );
        })}
      </div>
      <div id="validation-findings" className="validation-findings" role="tabpanel" aria-labelledby={`validation-tab-${activeCategory}`}>
        {findings.length === 0 ? <p className="validation-empty">No {activeCategory} findings.</p> : findings.map((finding, index) => {
          const key = `${finding.code}:${finding.objectId ?? index}`;
          const isReviewed = reviewed.has(key);
          return (
            <article className={`validation-finding finding-${finding.severity}${isReviewed ? " is-reviewed" : ""}`} key={key}>
              <div className="finding-copy">
                <div className="finding-label"><span>{finding.code.replaceAll("_", " ")}</span><small>{finding.severity}{finding.blocksPublication ? " · publication blocker" : " · advisory"}</small></div>
                <p>{finding.message}</p>
                <small>{finding.suggestion}</small>
              </div>
              <div className="finding-actions">
                {finding.objectId && <button type="button" onClick={() => onSelectObject(finding.objectId)}>Locate</button>}
                {finding.category === "editorial" && (
                  <button type="button" aria-pressed={isReviewed} onClick={() => setReviewed((current) => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })}>{isReviewed ? "Reviewed" : "Mark reviewed"}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="validation-footer">Readiness assessment only. This Studio has no publishing system; editorial prompts are not objective artistic errors.</p>
    </section>
  );
}