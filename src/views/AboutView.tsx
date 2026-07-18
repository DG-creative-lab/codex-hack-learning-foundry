export function AboutView() {
  return (
    <div className="page-scroll about-view">
      <section className="about-statement">
        <p className="eyebrow">Learning Foundry</p>
        <h2>A universal learning environment for people and their agents.</h2>
        <p>
          Approved literature, papers, talks, documentation, and lived experience become source-grounded knowledge. That
          knowledge produces adaptive human learning and controlled agent capabilities. Application outcomes return as
          evidence so both can improve.
        </p>
      </section>
      <section className="about-columns">
        <div>
          <span>01</span>
          <h3>Ingest anything approved</h3>
          <p>Local files and online sources enter through one provenance-preserving pipeline.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Learn on both sides</h3>
          <p>Human artifacts and agent memory derive from the same knowledge without collapsing into one state.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Apply and revise</h3>
          <p>Skills, tools, and plugins evolve through evaluation, execution feedback, and approval.</p>
        </div>
      </section>
    </div>
  );
}
