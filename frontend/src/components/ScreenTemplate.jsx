export default function ScreenTemplate({ title, description, requirements }) {
  return (
    <section className="screen-template">
      <header className="screen-heading">
        <p className="eyebrow">QueueSmart</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      {/* TODO: Replace this box with the screen's actual JSX. */}
      <div className="todo-box">
        <h2>Build this screen</h2>
        <ul>
          {requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
