# Review Output Contract

## Human-readable report

Return sections in this order:

1. Audience and outcome
2. Observed interface evidence
3. Five-lens diagnosis
4. Highest-value changes
5. Constraints and tradeoffs
6. Uncertainty and validation plan

For each recommendation include:

- Change
- Density dimension primarily affected
- Expected value for the named audience
- Evidence reference
- Tradeoff or failure mode
- Verification method

## Machine-readable report

Use this shape for evaluation:

```json
{
  "audience": "Named audience and expertise",
  "outcome": "The valuable outcome",
  "observations": ["Directly observed interface evidence"],
  "lenses": [
    { "id": "visual", "diagnosis": "...", "evidenceRefs": ["artifact:..."], "confidence": 0.8 },
    { "id": "information", "diagnosis": "...", "evidenceRefs": ["artifact:..."], "confidence": 0.8 },
    { "id": "meaning", "diagnosis": "...", "evidenceRefs": ["artifact:..."], "confidence": 0.8 },
    { "id": "time", "diagnosis": "...", "evidenceRefs": ["artifact:..."], "confidence": 0.8 },
    { "id": "value", "diagnosis": "...", "evidenceRefs": ["artifact:..."], "confidence": 0.8 }
  ],
  "recommendations": [
    {
      "change": "...",
      "dimension": "time",
      "expectedValue": "...",
      "evidenceRefs": ["artifact:...", "source:..."],
      "tradeoff": "...",
      "verification": "..."
    }
  ],
  "constraints": ["Accessibility or product boundary"],
  "preferences": ["Explicit user taste, if supplied"],
  "uncertainties": ["Missing evidence or assumption"]
}
```

